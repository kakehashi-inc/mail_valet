import http from 'http';
import crypto from 'crypto';
import { BrowserWindow } from 'electron';
import type {
    AccountTokens,
    GmailLabel,
    EmailMessage,
    SamplingResult,
    SamplingMeta,
    FetchProgress,
    FetchEmailsOptions,
    FetchMode,
    FromGroup,
    DeleteResult,
    DeleteSettings,
    AIJudgment,
    EmailBodyParts,
} from '../../shared/types';
import {
    GMAIL_API_BASE,
    GOOGLE_OAUTH_AUTH_URL,
    GOOGLE_OAUTH_TOKEN_URL,
    GOOGLE_USERINFO_URL,
    GMAIL_SCOPES,
    OAUTH_REDIRECT_URI,
    getSamplingResultPath,
    getSamplingMetaPath,
} from '../../shared/constants';
import { readJsonFile, writeJsonFile } from './file-manager';
import { getAccountTokens, saveAccountTokens } from './account-manager';
import { getFetchSettings } from './settings-manager';

type ProgressCallback = (progress: FetchProgress) => void;

// --- OAuth2 ---
export async function startOAuthFlow(
    clientId: string,
    clientSecret: string
): Promise<{ tokens: AccountTokens; email: string; displayName: string } | null> {
    return new Promise(resolve => {
        const server = http.createServer();
        let port = 0;

        server.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            if (!addr || typeof addr === 'string') {
                server.close();
                resolve(null);
                return;
            }
            port = addr.port;
            const redirectUri = `${OAUTH_REDIRECT_URI}:${port}`;
            const state = crypto.randomBytes(16).toString('hex');
            const authUrl =
                `${GOOGLE_OAUTH_AUTH_URL}?` +
                new URLSearchParams({
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    response_type: 'code',
                    scope: GMAIL_SCOPES.join(' '),
                    access_type: 'offline',
                    prompt: 'consent',
                    state,
                }).toString();

            const authWindow = new BrowserWindow({
                width: 600,
                height: 700,
                show: true,
                webPreferences: { nodeIntegration: false, contextIsolation: true },
            });
            authWindow.loadURL(authUrl);

            let resolved = false;
            server.on('request', async (req, res) => {
                if (resolved) return;
                const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
                const code = url.searchParams.get('code');
                const returnedState = url.searchParams.get('state');

                if (code && returnedState === state) {
                    resolved = true;
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    res.end(
                        '<html><body><h2>Authentication successful. You can close this window.</h2><script>window.close()</script></body></html>'
                    );
                    authWindow.close();
                    server.close();

                    try {
                        const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                code,
                                client_id: clientId,
                                client_secret: clientSecret,
                                redirect_uri: redirectUri,
                                grant_type: 'authorization_code',
                            }),
                        });
                        const tokenData = (await tokenResponse.json()) as any;
                        if (!tokenData.access_token) {
                            resolve(null);
                            return;
                        }
                        const tokens: AccountTokens = {
                            accessToken: tokenData.access_token,
                            refreshToken: tokenData.refresh_token || '',
                            expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
                        };

                        const userResponse = await fetch(GOOGLE_USERINFO_URL, {
                            headers: { Authorization: `Bearer ${tokens.accessToken}` },
                        });
                        const userInfo = (await userResponse.json()) as any;
                        resolve({
                            tokens,
                            email: userInfo.email || '',
                            displayName: userInfo.name || userInfo.email || '',
                        });
                    } catch {
                        resolve(null);
                    }
                } else {
                    res.writeHead(400);
                    res.end('Authentication failed');
                }
            });

            authWindow.on('closed', () => {
                if (!resolved) {
                    resolved = true;
                    server.close();
                    resolve(null);
                }
            });
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    authWindow.close();
                    server.close();
                    resolve(null);
                }
            }, 300000);
        });
    });
}

// --- Token refresh ---
async function refreshAccessToken(accountId: string, clientId: string, clientSecret: string): Promise<string | null> {
    const tokens = await getAccountTokens(accountId);
    if (!tokens?.refreshToken) return null;

    try {
        const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                refresh_token: tokens.refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: 'refresh_token',
            }),
        });
        const data = (await response.json()) as any;
        if (!data.access_token) return null;
        const newTokens: AccountTokens = {
            accessToken: data.access_token,
            refreshToken: tokens.refreshToken,
            expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };
        await saveAccountTokens(accountId, newTokens);
        return data.access_token;
    } catch {
        return null;
    }
}

// --- Authorized fetch helper ---
async function gmailFetch(
    accountId: string,
    clientId: string,
    clientSecret: string,
    endpoint: string,
    options?: RequestInit
): Promise<any> {
    let tokens = await getAccountTokens(accountId);
    if (!tokens) throw new Error('No tokens');

    if (Date.now() >= tokens.expiresAt - 60000) {
        const newToken = await refreshAccessToken(accountId, clientId, clientSecret);
        if (!newToken) throw new Error('Token refresh failed');
        tokens = { ...tokens, accessToken: newToken };
    }

    const response = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
        ...options,
        headers: { Authorization: `Bearer ${tokens.accessToken}`, ...(options?.headers || {}) },
    });

    if (response.status === 401) {
        const newToken = await refreshAccessToken(accountId, clientId, clientSecret);
        if (!newToken) throw new Error('Token refresh failed');
        const retryResponse = await fetch(`${GMAIL_API_BASE}${endpoint}`, {
            ...options,
            headers: { Authorization: `Bearer ${newToken}`, ...(options?.headers || {}) },
        });
        if (!retryResponse.ok) throw new Error(`Gmail API error: ${retryResponse.status}`);
        return retryResponse.json();
    }
    if (!response.ok) throw new Error(`Gmail API error: ${response.status}`);
    return response.json();
}

// --- Connection check ---
export async function checkConnection(accountId: string, clientId: string, clientSecret: string): Promise<boolean> {
    try {
        await gmailFetch(accountId, clientId, clientSecret, '/profile');
        return true;
    } catch {
        return false;
    }
}

// --- Labels ---
export async function fetchLabels(accountId: string, clientId: string, clientSecret: string): Promise<GmailLabel[]> {
    const data = await gmailFetch(accountId, clientId, clientSecret, '/labels');
    return (data.labels || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        type: l.type === 'system' ? 'system' : 'user',
    }));
}

// --- Email parsing helpers ---
function extractFromAddress(from: string): string {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

function decodeBase64Url(data: string): string {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractBody(payload: any): string {
    if (payload.body?.data) {
        return decodeBase64Url(payload.body.data);
    }
    if (payload.parts) {
        // Prefer text/plain, fall back to text/html
        const textPart = payload.parts.find((p: any) => p.mimeType === 'text/plain');
        if (textPart?.body?.data) return decodeBase64Url(textPart.body.data);
        const htmlPart = payload.parts.find((p: any) => p.mimeType === 'text/html');
        if (htmlPart?.body?.data) {
            const html = decodeBase64Url(htmlPart.body.data);
            return html
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }
        // Recursively search nested parts
        for (const part of payload.parts) {
            if (part.parts) {
                const nested = extractBody(part);
                if (nested) return nested;
            }
        }
    }
    return '';
}

function getHeader(headers: any[], name: string): string {
    const header = headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || '';
}

function parseMessage(msg: any): EmailMessage {
    const headers = msg.payload?.headers || [];
    const from = getHeader(headers, 'From');
    const to = getHeader(headers, 'To');
    const subject = getHeader(headers, 'Subject');
    const date = getHeader(headers, 'Date');
    const labelIds = msg.labelIds || [];
    return {
        id: msg.id,
        threadId: msg.threadId || '',
        from,
        fromAddress: extractFromAddress(from),
        to,
        subject,
        date,
        snippet: msg.snippet || '',
        labelIds,
        isImportant: labelIds.includes('IMPORTANT'),
        isStarred: labelIds.includes('STARRED'),
    };
}

// --- Build FromGroups ---
function buildFromGroups(messages: EmailMessage[], periodDays: number): FromGroup[] {
    const groups = new Map<string, EmailMessage[]>();
    for (const msg of messages) {
        const addr = msg.fromAddress;
        if (!groups.has(addr)) groups.set(addr, []);
        groups.get(addr)!.push(msg);
    }

    return Array.from(groups.entries()).map(([addr, msgs]) => {
        const fromNamesSet = new Set<string>();
        msgs.forEach(m => fromNamesSet.add(m.from));
        const sorted = [...msgs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return {
            fromAddress: addr,
            fromNames: Array.from(fromNamesSet),
            count: msgs.length,
            frequency: periodDays > 0 ? Math.round((msgs.length / periodDays) * 10) / 10 : msgs.length,
            latestSubject: sorted[0]?.subject || '',
            latestDate: sorted[0]?.date || '',
            messages: sorted,
            aiScoreRange: { marketing: [-1, -1] as [number, number], spam: [-1, -1] as [number, number] },
        };
    });
}

// --- Fetch Emails ---
export async function fetchEmails(
    options: FetchEmailsOptions,
    clientId: string,
    clientSecret: string,
    selectedLabelIds: string[],
    onProgress?: ProgressCallback
): Promise<SamplingResult> {
    const fetchSettings = await getFetchSettings();
    const maxResults = fetchSettings.maxFetchCount;

    let startDate: Date;
    let endDate = new Date();
    if (options.startDate && options.endDate && !options.useDays) {
        startDate = new Date(options.startDate);
        endDate = new Date(options.endDate);
    } else {
        const days = fetchSettings.samplingDays;
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
    }

    const afterEpoch = Math.floor(startDate.getTime() / 1000);
    const beforeEpoch = Math.floor(endDate.getTime() / 1000) + 86400;

    let query = `after:${afterEpoch} before:${beforeEpoch}`;
    if (fetchSettings.readFilter === 'unread') query += ' is:unread';
    else if (fetchSettings.readFilter === 'read') query += ' is:read';

    const labelQuery = selectedLabelIds.length > 0 ? selectedLabelIds.map(l => `label:${l}`).join(' OR ') : '';
    if (labelQuery) query += ` {${labelQuery}}`;

    onProgress?.({ current: 0, total: 0, message: 'Fetching message list...' });

    // Fetch message IDs
    const allMessageIds: string[] = [];
    let pageToken: string | undefined;
    do {
        const params = new URLSearchParams({
            q: query,
            maxResults: String(Math.min(500, maxResults - allMessageIds.length)),
        });
        if (pageToken) params.set('pageToken', pageToken);
        const listData = await gmailFetch(options.accountId, clientId, clientSecret, `/messages?${params}`);
        const msgs = listData.messages || [];
        allMessageIds.push(...msgs.map((m: any) => m.id));
        pageToken = listData.nextPageToken;
    } while (pageToken && allMessageIds.length < maxResults);

    const totalToFetch = allMessageIds.length;
    onProgress?.({ current: 0, total: totalToFetch, message: `Fetching ${totalToFetch} messages...` });

    // Fetch message details in batches
    const messages: EmailMessage[] = [];
    const batchSize = 10;
    for (let i = 0; i < allMessageIds.length; i += batchSize) {
        const batch = allMessageIds.slice(i, i + batchSize);
        const results = await Promise.all(
            batch.map(id =>
                gmailFetch(
                    options.accountId,
                    clientId,
                    clientSecret,
                    `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`
                )
            )
        );
        for (const msg of results) {
            messages.push(parseMessage(msg));
        }
        onProgress?.({
            current: messages.length,
            total: totalToFetch,
            message: `Fetched ${messages.length}/${totalToFetch} messages`,
        });
    }

    const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const fromGroups = buildFromGroups(messages, periodDays);

    const result: SamplingResult = {
        messages,
        fromGroups,
        periodStart: startDate.toISOString(),
        periodEnd: endDate.toISOString(),
        totalCount: messages.length,
    };

    const mode: FetchMode = options.useDays ? 'days' : 'range';
    const meta: SamplingMeta = {
        mode,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        fetchedAt: new Date().toISOString(),
        labelIds: selectedLabelIds,
        totalCount: messages.length,
    };

    // Save cache (per mode)
    await writeJsonFile(getSamplingResultPath(options.accountId, mode), result);
    await writeJsonFile(getSamplingMetaPath(options.accountId, mode), meta);

    return result;
}

// --- Get email body ---
export async function getEmailBody(
    accountId: string,
    messageId: string,
    clientId: string,
    clientSecret: string
): Promise<string> {
    const msg = await gmailFetch(accountId, clientId, clientSecret, `/messages/${messageId}?format=full`);
    return extractBody(msg.payload || {});
}

// --- Get email body parts (plain + html separately) ---
function extractBodyParts(payload: any): EmailBodyParts {
    const result: EmailBodyParts = { plain: '', html: '' };
    if (payload.body?.data) {
        const decoded = decodeBase64Url(payload.body.data);
        if (payload.mimeType === 'text/html') {
            result.html = decoded;
        } else {
            result.plain = decoded;
        }
        return result;
    }
    if (payload.parts) {
        for (const part of payload.parts) {
            if (part.mimeType === 'text/plain' && part.body?.data && !result.plain) {
                result.plain = decodeBase64Url(part.body.data);
            } else if (part.mimeType === 'text/html' && part.body?.data && !result.html) {
                result.html = decodeBase64Url(part.body.data);
            } else if (part.parts) {
                const nested = extractBodyParts(part);
                if (!result.plain && nested.plain) result.plain = nested.plain;
                if (!result.html && nested.html) result.html = nested.html;
            }
        }
    }
    return result;
}

export async function getEmailBodyParts(
    accountId: string,
    messageId: string,
    clientId: string,
    clientSecret: string
): Promise<EmailBodyParts> {
    const msg = await gmailFetch(accountId, clientId, clientSecret, `/messages/${messageId}?format=full`);
    return extractBodyParts(msg.payload || {});
}

// --- Get raw email ---
export async function getEmailRaw(
    accountId: string,
    messageId: string,
    clientId: string,
    clientSecret: string
): Promise<string> {
    const msg = await gmailFetch(accountId, clientId, clientSecret, `/messages/${messageId}?format=raw`);
    return msg.raw ? decodeBase64Url(msg.raw) : '';
}

// --- Bulk delete by From address (all-period) ---
async function searchMessageIds(
    accountId: string,
    clientId: string,
    clientSecret: string,
    query: string
): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
        const params = new URLSearchParams({ q: query, maxResults: '500' });
        if (pageToken) params.set('pageToken', pageToken);
        const data = await gmailFetch(accountId, clientId, clientSecret, `/messages?${params}`);
        const msgs = data.messages || [];
        ids.push(...msgs.map((m: any) => m.id));
        pageToken = data.nextPageToken;
    } while (pageToken);
    return ids;
}

export async function searchAndTrashByFrom(
    accountId: string,
    fromAddresses: string[],
    deleteSettings: DeleteSettings,
    clientId: string,
    clientSecret: string,
    onProgress?: ProgressCallback
): Promise<DeleteResult> {
    let totalTrashed = 0;
    let totalExcluded = 0;
    let totalErrors = 0;

    for (let i = 0; i < fromAddresses.length; i++) {
        const fromAddr = fromAddresses[i];
        onProgress?.({
            current: i,
            total: fromAddresses.length,
            message: `Searching: ${fromAddr} (${i + 1}/${fromAddresses.length})`,
        });

        // Build exclusion query parts
        const exclusions: string[] = [];
        if (deleteSettings.excludeImportant) exclusions.push('-is:important');
        if (deleteSettings.excludeStarred) exclusions.push('-is:starred');

        // Count total (without exclusions) to calculate excluded count
        const baseQuery = `from:${fromAddr}`;
        let totalForSender = 0;
        if (exclusions.length > 0) {
            const allIds = await searchMessageIds(accountId, clientId, clientSecret, baseQuery);
            totalForSender = allIds.length;
        }

        // Search with exclusions applied
        const filteredQuery = exclusions.length > 0 ? `${baseQuery} ${exclusions.join(' ')}` : baseQuery;
        const toTrashIds = await searchMessageIds(accountId, clientId, clientSecret, filteredQuery);

        if (exclusions.length > 0) {
            totalExcluded += totalForSender - toTrashIds.length;
        }

        // Trash in parallel batches
        const batchSize = 20;
        for (let j = 0; j < toTrashIds.length; j += batchSize) {
            const batch = toTrashIds.slice(j, j + batchSize);
            const results = await Promise.allSettled(
                batch.map(id =>
                    gmailFetch(accountId, clientId, clientSecret, `/messages/${id}/trash`, { method: 'POST' })
                )
            );
            for (const result of results) {
                if (result.status === 'fulfilled') totalTrashed++;
                else totalErrors++;
            }
            onProgress?.({
                current: i,
                total: fromAddresses.length,
                message: `Deleting: ${fromAddr} ${Math.min(j + batchSize, toTrashIds.length)}/${toTrashIds.length}`,
            });
        }
    }

    return { trashed: totalTrashed, excluded: totalExcluded, errors: totalErrors };
}

// --- Cache ---
export async function getCachedResult(
    accountId: string,
    mode: FetchMode = 'days'
): Promise<{ result: SamplingResult; meta: SamplingMeta } | null> {
    const result = await readJsonFile<SamplingResult | null>(getSamplingResultPath(accountId, mode), null);
    const meta = await readJsonFile<SamplingMeta | null>(getSamplingMetaPath(accountId, mode), null);
    if (result && meta) return { result, meta };
    return null;
}

// --- Update cached result with AI judgments ---
export async function updateCachedResultWithAI(
    accountId: string,
    mode: FetchMode,
    judgments: Map<string, AIJudgment>
): Promise<void> {
    const cached = await getCachedResult(accountId, mode);
    if (!cached) return;

    const updateMessages = (msgs: EmailMessage[]): EmailMessage[] =>
        msgs.map(msg => {
            const judgment = judgments.get(msg.id);
            return judgment ? { ...msg, aiJudgment: judgment } : msg;
        });

    const updatedMessages = updateMessages(cached.result.messages);
    const updatedFromGroups = cached.result.fromGroups.map(group => {
        const updatedGroupMessages = updateMessages(group.messages);
        const marketingScores = updatedGroupMessages.filter(m => m.aiJudgment).map(m => m.aiJudgment!.marketing);
        const spamScores = updatedGroupMessages.filter(m => m.aiJudgment).map(m => m.aiJudgment!.spam);
        return {
            ...group,
            messages: updatedGroupMessages,
            aiScoreRange: {
                marketing:
                    marketingScores.length > 0
                        ? ([Math.min(...marketingScores), Math.max(...marketingScores)] as [number, number])
                        : ([-1, -1] as [number, number]),
                spam:
                    spamScores.length > 0
                        ? ([Math.min(...spamScores), Math.max(...spamScores)] as [number, number])
                        : ([-1, -1] as [number, number]),
            },
        };
    });

    const updatedResult: SamplingResult = {
        ...cached.result,
        messages: updatedMessages,
        fromGroups: updatedFromGroups,
    };
    await writeJsonFile(getSamplingResultPath(accountId, mode), updatedResult);
}
