import net from 'net';
import { lookup } from 'dns/promises';
import { ImapFlow } from 'imapflow';
import type {
    ImapConnectionSettings,
    MailLabel,
    EmailMessage,
    SamplingResult,
    SamplingMeta,
    FetchProgress,
    FetchEmailsOptions,
    FetchMode,
    DeleteResult,
    DeleteSettings,
    EmailBodyParts,
    RuleLine,
    EmptyTrashResult,
} from '../../shared/types';
import { matchesRuleLine, extractSearchKeywords } from './rule-matcher';
import { getSamplingResultPath, getSamplingMetaPath } from '../../shared/constants';
import { writeJsonFile } from './file-manager';
import { buildFromGroups, getCachedResult } from './gmail-service';
import { getFetchSettings } from './settings-manager';

type ProgressCallback = (progress: FetchProgress) => void;

// Local type for imapflow mailbox list result
interface ImapMailbox {
    path: string;
    name: string;
    specialUse?: string;
}

// ---------------------------------------------------------------------------
// TCP reachability probe (single-stack, bypasses Happy Eyeballs)
// ---------------------------------------------------------------------------

const IPV4_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const IPV6_RE = /^[0-9a-fA-F:]+$/;

async function resolveHost(host: string): Promise<string | null> {
    if (IPV4_RE.test(host) || IPV6_RE.test(host)) return host;
    // OS の getaddrinfo を使用（c-ares の resolve4/resolve6 は Windows で失敗することがある）
    try {
        const { address } = await lookup(host, { family: 4 });
        return address;
    } catch {
        // IPv4 失敗時は IPv6 を試行
    }
    try {
        const { address } = await lookup(host, { family: 6 });
        return address;
    } catch {
        // ignore
    }
    return null;
}

function tcpProbe(host: string, port: number, timeout: number): Promise<boolean> {
    return new Promise(resolve => {
        const socket = net.createConnection({ host, port });
        const timer = setTimeout(() => {
            socket.destroy();
            resolve(false);
        }, timeout);
        socket.on('connect', () => {
            clearTimeout(timer);
            socket.destroy();
            resolve(true);
        });
        socket.on('error', () => {
            clearTimeout(timer);
            socket.destroy();
            resolve(false);
        });
    });
}

/**
 * Wait until host:port is TCP-reachable.
 */
async function waitForHostReachable(host: string, port: number): Promise<boolean> {
    const maxAttempts = 5;
    const probeTimeout = 2000;
    const retryDelay = 2000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const ip = await resolveHost(host);
        if (!ip) {
            console.warn(`[IMAP] DNS resolve failed for ${host} (attempt ${attempt}/${maxAttempts})`);
        } else {
            const reachable = await tcpProbe(ip, port, probeTimeout);
            if (reachable) {
                if (attempt > 1) {
                    console.log(`[IMAP] Host ${host}:${port} reachable after ${attempt} attempts`);
                }
                return true;
            }
            console.warn(`[IMAP] TCP probe ${host}:${port} failed (attempt ${attempt}/${maxAttempts})`);
        }
        if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, retryDelay));
        }
    }
    console.error(`[IMAP] Host ${host}:${port} not reachable after ${maxAttempts} attempts`);
    return false;
}

// ---------------------------------------------------------------------------
// ImapFlow client creation
// ---------------------------------------------------------------------------

function createImapClient(settings: ImapConnectionSettings): ImapFlow {
    return new ImapFlow({
        host: settings.host,
        port: settings.port,
        secure: settings.security === 'ssl',
        auth: { user: settings.username, pass: settings.password },
        tls:
            settings.security === 'starttls'
                ? { rejectUnauthorized: false }
                : settings.security === 'none'
                  ? { rejectUnauthorized: false }
                  : undefined,
        logger: {
            debug: () => {},
            info: () => {},
            warn: (msg: any) => console.warn('[ImapFlow]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
            error: (msg: any) => console.error('[ImapFlow]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
        },
    });
}

// --- Fetch cancel ---
let fetchCancelRequested = false;
let fetchClient: ImapFlow | null = null;

export function cancelFetch(): void {
    fetchCancelRequested = true;
    if (fetchClient) {
        try {
            fetchClient.close();
        } catch {
            // ignore
        }
    }
}

// --- Connection check ---
export async function checkConnection(settings: ImapConnectionSettings): Promise<boolean> {
    // Verify TCP reachability before attempting IMAP protocol connection
    const reachable = await waitForHostReachable(settings.host, settings.port);
    if (!reachable) return false;

    const client = createImapClient(settings);
    try {
        await client.connect();
        await client.logout();
        return true;
    } catch (e) {
        console.error('[IMAP] checkConnection failed:', e);
        return false;
    } finally {
        client.close();
    }
}

// --- Fetch folders (equivalent to Gmail labels) ---
export async function fetchFolders(settings: ImapConnectionSettings): Promise<MailLabel[]> {
    const client = createImapClient(settings);
    try {
        await client.connect();
        const mailboxes = await client.list();
        await client.logout();
        return mailboxes.map((mb: ImapMailbox) => ({
            id: mb.path,
            name: mb.name,
            type: mb.specialUse ? 'system' : 'user',
        }));
    } finally {
        client.close();
    }
}

// --- Helper: format From address ---
function formatFromAddress(name?: string, address?: string): string {
    if (name && address) return `${name} <${address}>`;
    return address || name || '';
}

function extractFromAddress(from: string): string {
    const match = from.match(/<([^>]+)>/);
    return match ? match[1].toLowerCase() : from.toLowerCase().trim();
}

// --- Helper: find Trash folder path ---
async function findTrashFolder(client: ImapFlow): Promise<string> {
    const mailboxes = await client.list();
    // Look for \Trash special use
    const trash = mailboxes.find((mb: ImapMailbox) => mb.specialUse === '\\Trash');
    if (trash) {
        return trash.path;
    }
    // Fallback: common names
    const fallbacks = ['Trash', 'Deleted Items', 'Deleted Messages', 'Deleted'];
    for (const name of fallbacks) {
        const found = mailboxes.find((mb: ImapMailbox) => mb.path.toLowerCase() === name.toLowerCase());
        if (found) {
            console.warn(`[IMAP] Trash folder found by name fallback: ${found.path}`);
            return found.path;
        }
    }
    console.error(
        '[IMAP] No Trash folder found! Available:',
        mailboxes.map((mb: ImapMailbox) => `${mb.path} (${mb.specialUse || 'no specialUse'})`).join(', ')
    );
    return 'Trash';
}

// --- Fetch Emails ---
export async function fetchEmails(
    options: FetchEmailsOptions,
    settings: ImapConnectionSettings,
    selectedFolderPaths: string[],
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

    // Use sentSince/sentBefore with UTC midnight dates to avoid imapflow's WITHIN extension
    // (WITHIN converts since/before to YOUNGER/OLDER which some IMAP servers reject)
    const sinceDateUtc = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
    const beforeDateUtc = new Date(Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1));
    const searchQuery: any = { sentSince: sinceDateUtc, sentBefore: beforeDateUtc };
    if (fetchSettings.readFilter === 'unread') searchQuery.seen = false;
    else if (fetchSettings.readFilter === 'read') searchQuery.seen = true;

    console.debug(
        `[IMAP] fetchEmails: ${startDate.toISOString()} - ${endDate.toISOString()}, readFilter=${fetchSettings.readFilter}, max=${maxResults}`
    );
    onProgress?.({ current: 0, total: 0, message: 'Connecting to IMAP server...' });

    fetchCancelRequested = false;
    const client = createImapClient(settings);
    fetchClient = client;
    try {
        await client.connect();
        console.debug(`[IMAP] Connected to ${settings.host}:${settings.port}`);
        const messages: EmailMessage[] = [];
        const bodyPartsMap: Record<string, EmailBodyParts> = {};
        const rawBodiesMap: Record<string, string> = {};
        const folders = selectedFolderPaths.length > 0 ? selectedFolderPaths : ['INBOX'];
        console.debug(`[IMAP] Target folders: ${folders.join(', ')}`);

        for (const folderPath of folders) {
            if (fetchCancelRequested) break;
            if (messages.length >= maxResults) break;
            try {
                const lock = await client.getMailboxLock(folderPath);
                try {
                    const uids: number[] | false = await client.search(searchQuery, { uid: true });

                    if (!uids || uids.length === 0) {
                        console.debug(`[IMAP] ${folderPath}: 0 messages found`);
                        continue;
                    }

                    const targetUids = uids.slice(0, maxResults - messages.length);
                    console.debug(`[IMAP] ${folderPath}: ${uids.length} found, fetching ${targetUids.length}`);
                    onProgress?.({
                        current: messages.length,
                        total: messages.length + targetUids.length,
                        message: `Fetching from ${folderPath}...`,
                    });

                    // Pass 1: fetch envelope + flags + bodyStructure
                    const fetched: Array<{
                        uid: number;
                        envelope: any;
                        flags: Set<string>;
                        bodyStructure: any;
                    }> = [];
                    for await (const msg of client.fetch(
                        targetUids,
                        { envelope: true, flags: true, uid: true, bodyStructure: true },
                        { uid: true }
                    )) {
                        if (messages.length + fetched.length >= maxResults) break;
                        fetched.push({
                            uid: msg.uid,
                            envelope: msg.envelope,
                            flags: msg.flags || new Set(),
                            bodyStructure: msg.bodyStructure,
                        });
                    }

                    // Pass 2: build messages + download body parts + raw (single connection)
                    for (let fi = 0; fi < fetched.length && !fetchCancelRequested; fi++) {
                        const f = fetched[fi];
                        const fromObj = f.envelope?.from?.[0];
                        const toObj = f.envelope?.to?.[0];
                        const from = formatFromAddress(fromObj?.name, fromObj?.address);
                        const flags = Array.from(f.flags);
                        const msgId = `${folderPath}:${f.uid}`;
                        messages.push({
                            id: msgId,
                            threadId: '',
                            from,
                            fromAddress: extractFromAddress(from),
                            to: formatFromAddress(toObj?.name, toObj?.address),
                            subject: f.envelope?.subject || '',
                            date: f.envelope?.date ? f.envelope.date.toISOString() : '',
                            snippet: '',
                            labelIds: [folderPath],
                            isImportant: flags.includes('\\Flagged'),
                            isStarred: flags.includes('\\Flagged'),
                        });

                        // Download body parts
                        try {
                            bodyPartsMap[msgId] = await fetchBodyPartsForMessage(client, f.uid, f.bodyStructure);
                        } catch (e) {
                            console.warn(`[IMAP] Failed to fetch body for ${msgId}:`, e);
                        }

                        // Download raw source
                        try {
                            const dl = await client.download(String(f.uid), undefined, { uid: true });
                            if (dl) rawBodiesMap[msgId] = await streamToString(dl.content);
                        } catch (e) {
                            console.warn(`[IMAP] Failed to fetch raw for ${msgId}:`, e);
                        }

                        if ((fi + 1) % 50 === 0) {
                            onProgress?.({
                                current: messages.length,
                                total: messages.length + fetched.length - fi - 1,
                                message: `Fetched ${messages.length} messages...`,
                            });
                        }
                    }
                } finally {
                    lock.release();
                }
            } catch (e) {
                console.error(`[IMAP] Error in folder ${folderPath}:`, e);
            }
        }

        console.info(`[IMAP] Fetch complete: ${messages.length} messages, ${Object.keys(bodyPartsMap).length} bodies`);
        await client.logout();

        const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const fromGroups = buildFromGroups(messages, periodDays);

        const result: SamplingResult = {
            messages,
            fromGroups,
            periodStart: startDate.toISOString(),
            periodEnd: endDate.toISOString(),
            totalCount: messages.length,
            bodyParts: bodyPartsMap,
            rawBodies: rawBodiesMap,
        };

        const mode: FetchMode = options.useDays ? 'days' : 'range';
        const meta: SamplingMeta = {
            mode,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            fetchedAt: new Date().toISOString(),
            labelIds: selectedFolderPaths,
            totalCount: messages.length,
        };

        await writeJsonFile(getSamplingResultPath(options.accountId, mode), result);
        await writeJsonFile(getSamplingMetaPath(options.accountId, mode), meta);

        return result;
    } catch (e) {
        if (fetchCancelRequested) {
            console.info('[IMAP] fetchEmails cancelled');
            throw new Error('Fetch cancelled');
        }
        console.error('[IMAP] fetchEmails failed:', e);
        throw e;
    } finally {
        fetchClient = null;
        client.close();
    }
}

// --- Helper: parse IMAP message ID "folderPath:uid" ---
function parseImapMessageId(messageId: string): { folderPath: string; uid: number } {
    const lastColon = messageId.lastIndexOf(':');
    if (lastColon === -1) return { folderPath: 'INBOX', uid: parseInt(messageId, 10) };
    return {
        folderPath: messageId.substring(0, lastColon),
        uid: parseInt(messageId.substring(lastColon + 1), 10),
    };
}

// --- Helper: stream to string ---
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

// --- Helper: strip HTML tags ---
function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// --- Cached body parts lookup (searches both 'days' and 'range' sampling caches) ---
export async function getCachedBodyParts(accountId: string, messageId: string): Promise<EmailBodyParts | null> {
    for (const mode of ['days', 'range'] as const) {
        const cached = await getCachedResult(accountId, mode);
        if (cached?.result.bodyParts?.[messageId]) return cached.result.bodyParts[messageId];
    }
    return null;
}

// --- Get email body (from cache) ---
export async function getEmailBody(accountId: string, messageId: string): Promise<string> {
    const cached = await getCachedBodyParts(accountId, messageId);
    if (cached) {
        if (cached.plain) return cached.plain;
        if (cached.html) return stripHtml(cached.html);
        return '';
    }
    return '';
}

// --- Get email body parts (from cache) ---
export async function getEmailBodyParts(accountId: string, messageId: string): Promise<EmailBodyParts> {
    const cached = await getCachedBodyParts(accountId, messageId);
    return cached || { plain: '', html: '' };
}

// --- Helper: flatten bodyStructure ---
function flattenStructure(structure: any): Array<{ type: string; part?: string }> {
    if (!structure) return [];
    const result: Array<{ type: string; part?: string }> = [];
    if (structure.type && !structure.type.startsWith('multipart/')) {
        result.push({ type: structure.type, part: structure.part });
    }
    if (structure.childNodes) {
        for (const child of structure.childNodes) {
            result.push(...flattenStructure(child));
        }
    }
    return result;
}

// --- Get raw email ---
export async function getEmailRaw(accountId: string, messageId: string): Promise<string> {
    for (const mode of ['days', 'range'] as const) {
        const cached = await getCachedResult(accountId, mode);
        if (cached?.result.rawBodies?.[messageId]) return cached.result.rawBodies[messageId];
    }
    return '';
}

// --- Live fetch (for trash or uncached messages) ---
export async function getEmailBodyPartsLive(
    settings: ImapConnectionSettings,
    messageId: string
): Promise<EmailBodyParts> {
    const { folderPath, uid } = parseImapMessageId(messageId);
    const client = createImapClient(settings);
    try {
        await client.connect();
        const lock = await client.getMailboxLock(folderPath);
        try {
            // Pass 1: fetch bodyStructure only
            let bodyStructure: any = null;
            for await (const msg of client.fetch([uid], { bodyStructure: true, uid: true }, { uid: true })) {
                bodyStructure = msg.bodyStructure;
            }
            // Pass 2: download body parts using bodyStructure
            if (bodyStructure) {
                return await fetchBodyPartsForMessage(client, uid, bodyStructure);
            }
        } finally {
            lock.release();
        }
        await client.logout();
    } catch (e) {
        console.error('[IMAP] Failed to live-fetch body parts:', e);
    } finally {
        client.close();
    }
    return { plain: '', html: '' };
}

export async function getEmailRawLive(settings: ImapConnectionSettings, messageId: string): Promise<string> {
    const { folderPath, uid } = parseImapMessageId(messageId);
    const client = createImapClient(settings);
    try {
        await client.connect();
        const lock = await client.getMailboxLock(folderPath);
        try {
            const dl = await client.download(String(uid), undefined, { uid: true });
            if (dl) return await streamToString(dl.content);
        } finally {
            lock.release();
        }
        await client.logout();
    } catch (e) {
        console.error('[IMAP] Failed to live-fetch raw:', e);
    } finally {
        client.close();
    }
    return '';
}

// --- Bulk delete by From address ---
export async function searchAndTrashByFrom(
    settings: ImapConnectionSettings,
    fromAddresses: string[],
    deleteSettings: DeleteSettings,
    onProgress?: ProgressCallback
): Promise<DeleteResult> {
    let totalTrashed = 0;
    let totalExcluded = 0;
    let totalErrors = 0;

    const client = createImapClient(settings);
    try {
        await client.connect();
        const trashPath = await findTrashFolder(client);
        const mailboxes = await client.list();
        const searchableFolders = mailboxes
            .filter((mb: ImapMailbox) => !mb.specialUse || (mb.specialUse !== '\\Trash' && mb.specialUse !== '\\Junk'))
            .map((mb: ImapMailbox) => mb.path);

        for (let i = 0; i < fromAddresses.length; i++) {
            const fromAddr = fromAddresses[i];
            const label = `${i + 1}/${fromAddresses.length} ${fromAddr}`;
            let processed = 0;
            let found = 0;

            for (const folder of searchableFolders) {
                try {
                    const lock = await client.getMailboxLock(folder);
                    try {
                        const allUids = await client.search({ from: fromAddr }, { uid: true });
                        if (!allUids || allUids.length === 0) continue;

                        found += allUids.length;
                        onProgress?.({ current: processed, total: found, message: label });

                        let toTrashUids: number[] = allUids;
                        if (deleteSettings.excludeImportant || deleteSettings.excludeStarred) {
                            const flaggedUids = await client.search({ from: fromAddr, flagged: true }, { uid: true });
                            const flaggedSet = new Set(flaggedUids || []);
                            toTrashUids = allUids.filter((uid: number) => !flaggedSet.has(uid));
                            totalExcluded += allUids.length - toTrashUids.length;
                        }

                        if (toTrashUids.length > 0) {
                            try {
                                await client.messageMove(toTrashUids, trashPath, { uid: true });
                                totalTrashed += toTrashUids.length;
                            } catch (e) {
                                console.error(`[IMAP] messageMove failed in ${folder}:`, e);
                                totalErrors += toTrashUids.length;
                            }
                        }

                        processed += allUids.length;
                        onProgress?.({ current: processed, total: found, message: label });
                    } finally {
                        lock.release();
                    }
                } catch (e) {
                    console.error(`[IMAP] searchAndTrashByFrom error in folder ${folder}:`, e);
                }
            }
        }

        await client.logout();
    } finally {
        client.close();
    }

    return { trashed: totalTrashed, excluded: totalExcluded, errors: totalErrors };
}

// --- Bulk delete by Subject ---
export async function searchAndTrashBySubject(
    settings: ImapConnectionSettings,
    subjects: string[],
    deleteSettings: DeleteSettings,
    onProgress?: ProgressCallback
): Promise<DeleteResult> {
    let totalTrashed = 0;
    let totalExcluded = 0;
    let totalErrors = 0;

    const client = createImapClient(settings);
    try {
        await client.connect();
        const trashPath = await findTrashFolder(client);
        const mailboxes = await client.list();
        const searchableFolders = mailboxes
            .filter((mb: ImapMailbox) => !mb.specialUse || (mb.specialUse !== '\\Trash' && mb.specialUse !== '\\Junk'))
            .map((mb: ImapMailbox) => mb.path);

        for (let i = 0; i < subjects.length; i++) {
            const subj = subjects[i];
            const label = `${i + 1}/${subjects.length} ${subj}`;
            let processed = 0;
            let found = 0;

            for (const folder of searchableFolders) {
                try {
                    const lock = await client.getMailboxLock(folder);
                    try {
                        const allUids = await client.search({ subject: subj }, { uid: true });
                        if (!allUids || allUids.length === 0) continue;

                        found += allUids.length;
                        onProgress?.({ current: processed, total: found, message: label });

                        let toTrashUids: number[] = allUids;
                        if (deleteSettings.excludeImportant || deleteSettings.excludeStarred) {
                            const flaggedUids = await client.search({ subject: subj, flagged: true }, { uid: true });
                            const flaggedSet = new Set(flaggedUids || []);
                            toTrashUids = allUids.filter((uid: number) => !flaggedSet.has(uid));
                            totalExcluded += allUids.length - toTrashUids.length;
                        }

                        if (toTrashUids.length > 0) {
                            try {
                                await client.messageMove(toTrashUids, trashPath, { uid: true });
                                totalTrashed += toTrashUids.length;
                            } catch (e) {
                                console.error(`[IMAP] messageMove failed in ${folder}:`, e);
                                totalErrors += toTrashUids.length;
                            }
                        }

                        processed += allUids.length;
                        onProgress?.({ current: processed, total: found, message: label });
                    } finally {
                        lock.release();
                    }
                } catch (e) {
                    console.error(`[IMAP] searchAndTrashBySubject error in folder ${folder}:`, e);
                }
            }
        }

        await client.logout();
    } finally {
        client.close();
    }

    return { trashed: totalTrashed, excluded: totalExcluded, errors: totalErrors };
}

// --- Delete by specific message IDs (period delete) ---
export async function trashByMessageIds(
    settings: ImapConnectionSettings,
    messageIds: string[],
    onProgress?: ProgressCallback
): Promise<DeleteResult> {
    let totalTrashed = 0;
    let totalErrors = 0;

    // Group by folder
    const byFolder = new Map<string, number[]>();
    for (const msgId of messageIds) {
        const { folderPath, uid } = parseImapMessageId(msgId);
        if (!byFolder.has(folderPath)) byFolder.set(folderPath, []);
        byFolder.get(folderPath)!.push(uid);
    }

    const client = createImapClient(settings);
    try {
        await client.connect();
        const trashPath = await findTrashFolder(client);
        let processed = 0;

        for (const [folder, uids] of byFolder) {
            try {
                const lock = await client.getMailboxLock(folder);
                try {
                    await client.messageMove(uids, trashPath, { uid: true });
                    totalTrashed += uids.length;
                } catch (e) {
                    console.error(`[IMAP] trashByMessageIds move failed in ${folder}:`, e);
                    totalErrors += uids.length;
                } finally {
                    lock.release();
                }
            } catch (e) {
                console.error(`[IMAP] trashByMessageIds lock failed for ${folder}:`, e);
                totalErrors += uids.length;
            }
            processed += uids.length;
            onProgress?.({
                current: processed,
                total: messageIds.length,
                message: `Deleting: ${processed}/${messageIds.length}`,
            });
        }

        await client.logout();
    } finally {
        client.close();
    }

    return { trashed: totalTrashed, excluded: 0, errors: totalErrors };
}

// --- Bulk delete by Rule ---
/**
 * Build IMAP search criteria from rule keywords for pre-filtering.
 * Returns a search object that narrows down candidates before client-side regex matching.
 */
function buildImapSearchFromRule(ruleLine: RuleLine): Record<string, any> {
    const searchParts = extractSearchKeywords(ruleLine);
    if (searchParts.length === 0) return {};

    // Build IMAP SEARCH criteria using the first keyword per field type.
    // IMAP criteria object keys must be unique, so skip duplicate field types
    // to avoid overwriting (e.g. two subject patterns would overwrite each other).
    // Precise matching is done client-side with matchesRuleLine() afterward.
    const criteria: Record<string, any> = {};
    for (const part of searchParts) {
        const key = part.field === 'subject' ? 'subject' : part.field === 'body' ? 'body' : 'text';
        if (!(key in criteria)) {
            criteria[key] = part.keywords[0];
        }
    }
    return criteria;
}

export async function searchAndTrashByRule(
    settings: ImapConnectionSettings,
    ruleLines: RuleLine[],
    deleteSettings: DeleteSettings,
    onProgress?: ProgressCallback
): Promise<DeleteResult> {
    let totalTrashed = 0;
    let totalExcluded = 0;
    let totalErrors = 0;

    const client = createImapClient(settings);
    try {
        await client.connect();
        const trashPath = await findTrashFolder(client);
        const mailboxes = await client.list();
        const searchableFolders = mailboxes
            .filter((mb: ImapMailbox) => !mb.specialUse || (mb.specialUse !== '\\Trash' && mb.specialUse !== '\\Junk'))
            .map((mb: ImapMailbox) => mb.path);

        for (let i = 0; i < ruleLines.length; i++) {
            const ruleLine = ruleLines[i];
            const label = `${i + 1}/${ruleLines.length} ${ruleLine.rawText}`;

            // Build IMAP SEARCH pre-filter from rule keywords
            const searchCriteria = buildImapSearchFromRule(ruleLine);
            const hasSearchCriteria = Object.keys(searchCriteria).length > 0;

            let processed = 0;
            let totalCandidates = 0;

            for (const folder of searchableFolders) {
                try {
                    const lock = await client.getMailboxLock(folder);
                    try {
                        // Pre-filter with IMAP SEARCH if possible, otherwise get all UIDs
                        const candidateUids = hasSearchCriteria
                            ? await client.search(searchCriteria, { uid: true })
                            : await client.search({}, { uid: true });
                        if (!candidateUids || candidateUids.length === 0) continue;

                        // Step 1: Collect metadata (envelope, bodyStructure, flags)
                        const fetchedMsgs: Array<{
                            uid: number;
                            subject: string;
                            flags: string[];
                            bodyStructure: any;
                        }> = [];
                        for await (const msg of client.fetch(
                            candidateUids,
                            { envelope: true, bodyStructure: true, flags: true, uid: true },
                            { uid: true }
                        )) {
                            fetchedMsgs.push({
                                uid: msg.uid,
                                subject: msg.envelope?.subject || '',
                                flags: Array.from(msg.flags || new Set()),
                                bodyStructure: msg.bodyStructure,
                            });
                        }

                        totalCandidates += fetchedMsgs.length;
                        onProgress?.({ current: processed, total: totalCandidates, message: label });

                        // Step 2: For each candidate, fetch body parts and do regex matching
                        const matchingUids: number[] = [];
                        for (const fetched of fetchedMsgs) {
                            // Check exclusion settings
                            if (deleteSettings.excludeImportant && fetched.flags.includes('\\Flagged')) {
                                totalExcluded++;
                                processed++;
                                continue;
                            }
                            if (deleteSettings.excludeStarred && fetched.flags.includes('\\Flagged')) {
                                totalExcluded++;
                                processed++;
                                continue;
                            }

                            try {
                                const bodyParts = await fetchBodyPartsForMessage(
                                    client,
                                    fetched.uid,
                                    fetched.bodyStructure
                                );
                                if (matchesRuleLine(ruleLine, fetched.subject, bodyParts)) {
                                    matchingUids.push(fetched.uid);
                                }
                            } catch (e) {
                                console.error(`[IMAP] fetchBodyParts failed for uid ${fetched.uid}:`, e);
                                totalErrors++;
                            }

                            processed++;
                            if (processed % 10 === 0) {
                                onProgress?.({ current: processed, total: totalCandidates, message: label });
                            }
                        }

                        // Step 3: Move matching messages to trash
                        if (matchingUids.length > 0) {
                            try {
                                await client.messageMove(matchingUids, trashPath, { uid: true });
                                totalTrashed += matchingUids.length;
                            } catch (e) {
                                console.error(`[IMAP] messageMove failed in ${folder}:`, e);
                                totalErrors += matchingUids.length;
                            }
                        }
                    } finally {
                        lock.release();
                    }
                } catch (e) {
                    console.error(`[IMAP] searchAndTrashByRule error in folder ${folder}:`, e);
                }
            }
        }

        await client.logout();
    } finally {
        client.close();
    }

    return { trashed: totalTrashed, excluded: totalExcluded, errors: totalErrors };
}

// Helper to fetch body parts for a single message
async function fetchBodyPartsForMessage(client: ImapFlow, uid: number, bodyStructure: any): Promise<EmailBodyParts> {
    const bp: EmailBodyParts = { plain: '', html: '' };
    if (!bodyStructure) return bp;

    const parts = flattenStructure(bodyStructure);
    const plainPart = parts.find(p => p.type === 'text/plain');
    const htmlPart = parts.find(p => p.type === 'text/html');

    if (plainPart?.part) {
        const dl = await client.download(String(uid), plainPart.part, { uid: true });
        if (dl) bp.plain = await streamToString(dl.content);
    }
    if (htmlPart?.part) {
        const dl = await client.download(String(uid), htmlPart.part, { uid: true });
        if (dl) bp.html = await streamToString(dl.content);
    }

    return bp;
}

// --- Fetch trash emails ---
export async function fetchTrashEmails(
    settings: ImapConnectionSettings,
    onProgress?: ProgressCallback
): Promise<EmailMessage[]> {
    const messages: EmailMessage[] = [];

    const client = createImapClient(settings);
    try {
        await client.connect();
        const trashPath = await findTrashFolder(client);
        const lock = await client.getMailboxLock(trashPath);

        try {
            const uids = await client.search({}, { uid: true });
            if (!uids || uids.length === 0) return [];

            onProgress?.({ current: 0, total: uids.length, message: 'Loading trash...' });

            let processed = 0;
            for await (const msg of client.fetch(uids, { envelope: true, flags: true, uid: true }, { uid: true })) {
                const env = msg.envelope;
                const fromObj = env?.from?.[0];
                const toObj = env?.to?.[0];
                const from = formatFromAddress(fromObj?.name, fromObj?.address);
                const flags = Array.from(msg.flags || new Set());

                messages.push({
                    id: `${trashPath}:${msg.uid}`,
                    threadId: '',
                    from,
                    fromAddress: extractFromAddress(from),
                    to: formatFromAddress(toObj?.name, toObj?.address),
                    subject: env?.subject || '',
                    date: env?.date ? env.date.toISOString() : '',
                    snippet: '',
                    labelIds: [trashPath],
                    isImportant: flags.includes('\\Flagged'),
                    isStarred: flags.includes('\\Flagged'),
                });

                processed++;
                if (processed % 50 === 0) {
                    onProgress?.({
                        current: processed,
                        total: uids.length,
                        message: `Loading trash: ${processed}/${uids.length}`,
                    });
                }
            }
        } finally {
            lock.release();
        }

        await client.logout();
    } finally {
        client.close();
    }

    return messages;
}

// --- Empty trash (permanent delete) ---
export async function emptyTrash(
    settings: ImapConnectionSettings,
    onProgress?: ProgressCallback
): Promise<EmptyTrashResult> {
    let deleted = 0;
    let errors = 0;

    const client = createImapClient(settings);
    try {
        await client.connect();
        const trashPath = await findTrashFolder(client);
        const lock = await client.getMailboxLock(trashPath);

        try {
            const uids = await client.search({}, { uid: true });
            if (!uids || uids.length === 0) return { deleted: 0, errors: 0 };

            onProgress?.({ current: 0, total: uids.length, message: 'Emptying trash...' });

            try {
                // Mark as deleted and expunge
                await client.messageFlagsAdd(uids, ['\\Deleted'], { uid: true });
                await client.messageDelete(uids, { uid: true });
                deleted = uids.length;
            } catch (e) {
                console.error('[IMAP] emptyTrash failed:', e);
                errors = uids.length;
            }

            onProgress?.({
                current: deleted,
                total: uids.length,
                message: `Emptied ${deleted} messages`,
            });
        } finally {
            lock.release();
        }

        await client.logout();
    } finally {
        client.close();
    }

    return { deleted, errors };
}

// --- Delete selected trash messages (permanent delete) ---
export async function deleteTrashMessages(
    settings: ImapConnectionSettings,
    messageIds: string[],
    onProgress?: ProgressCallback
): Promise<EmptyTrashResult> {
    let deleted = 0;
    let errors = 0;

    if (messageIds.length === 0) return { deleted: 0, errors: 0 };

    // Parse message IDs to get UIDs (they're all in trash folder)
    const uids: number[] = messageIds.map(id => {
        const { uid } = parseImapMessageId(id);
        return uid;
    });

    const client = createImapClient(settings);
    try {
        await client.connect();
        const trashPath = await findTrashFolder(client);
        const lock = await client.getMailboxLock(trashPath);

        try {
            onProgress?.({ current: 0, total: uids.length, message: 'Deleting selected...' });

            try {
                await client.messageFlagsAdd(uids, ['\\Deleted'], { uid: true });
                await client.messageDelete(uids, { uid: true });
                deleted = uids.length;
            } catch (e) {
                console.error('[IMAP] deleteTrashMessages failed:', e);
                errors = uids.length;
            }

            onProgress?.({
                current: deleted,
                total: uids.length,
                message: `Deleted ${deleted} messages`,
            });
        } finally {
            lock.release();
        }

        await client.logout();
    } finally {
        client.close();
    }

    return { deleted, errors };
}

// Re-export shared functions
export { getCachedResult };
