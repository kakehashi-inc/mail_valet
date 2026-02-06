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
} from '../../shared/types';
import { getSamplingResultPath, getSamplingMetaPath } from '../../shared/constants';
import { writeJsonFile } from './file-manager';
import { buildFromGroups, getCachedResult } from './gmail-service';
import { getFetchSettings } from './settings-manager';

type ProgressCallback = (progress: FetchProgress) => void;

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
            info: (msg: any) => console.debug('[ImapFlow]', typeof msg === 'object' ? JSON.stringify(msg) : msg),
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
        return mailboxes.map(mb => ({
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
    const trash = mailboxes.find(mb => mb.specialUse === '\\Trash');
    if (trash) {
        console.debug(`[IMAP] Trash folder found: ${trash.path} (specialUse: \\Trash)`);
        return trash.path;
    }
    // Fallback: common names
    const fallbacks = ['Trash', 'Deleted Items', 'Deleted Messages', 'Deleted'];
    for (const name of fallbacks) {
        const found = mailboxes.find(mb => mb.path.toLowerCase() === name.toLowerCase());
        if (found) {
            console.warn(`[IMAP] Trash folder found by name fallback: ${found.path}`);
            return found.path;
        }
    }
    console.error(
        '[IMAP] No Trash folder found! Available:',
        mailboxes.map(mb => `${mb.path} (${mb.specialUse || 'no specialUse'})`).join(', ')
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
    const endDatePlusOne = new Date(endDate.getTime() + 86400000);
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
                    const mb = client.mailbox;
                    const totalExists = mb ? mb.exists || 0 : 0;
                    let uids: number[] | false = await client.search(searchQuery, { uid: true });
                    let clientSideDateFilter = false;

                    // Fallback: server may not support SINCE/BEFORE search
                    if ((!uids || uids.length === 0) && totalExists > 0) {
                        console.warn(
                            `[IMAP] ${folderPath}: Date search returned 0/${totalExists}, using client-side date filter`
                        );
                        uids = await client.search({}, { uid: true });
                        clientSideDateFilter = true;
                    }

                    if (!uids || uids.length === 0) {
                        console.debug(`[IMAP] ${folderPath}: 0 messages found`);
                        continue;
                    }

                    // Sort descending (higher UID = more recent) for client-side fallback
                    const targetUids = clientSideDateFilter
                        ? [...uids].sort((a, b) => b - a)
                        : uids.slice(0, maxResults - messages.length);
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
                        const env = msg.envelope;
                        if (clientSideDateFilter && env?.date) {
                            const msgDate = new Date(env.date);
                            if (msgDate < startDate || msgDate >= endDatePlusOne) continue;
                        }
                        fetched.push({
                            uid: msg.uid,
                            envelope: env,
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
                        if (f.bodyStructure) {
                            try {
                                const structParts = flattenStructure(f.bodyStructure);
                                const bp: EmailBodyParts = { plain: '', html: '' };
                                const plainPart = structParts.find(p => p.type === 'text/plain');
                                const htmlPart = structParts.find(p => p.type === 'text/html');
                                if (plainPart?.part) {
                                    const dl = await client.download(String(f.uid), plainPart.part, { uid: true });
                                    if (dl) bp.plain = await streamToString(dl.content);
                                }
                                if (htmlPart?.part) {
                                    const dl = await client.download(String(f.uid), htmlPart.part, { uid: true });
                                    if (dl) bp.html = await streamToString(dl.content);
                                }
                                bodyPartsMap[msgId] = bp;
                            } catch (e) {
                                console.warn(`[IMAP] Failed to fetch body for ${msgId}:`, e);
                            }
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
            .filter(mb => !mb.specialUse || (mb.specialUse !== '\\Trash' && mb.specialUse !== '\\Junk'))
            .map(mb => mb.path);

        for (let i = 0; i < fromAddresses.length; i++) {
            const fromAddr = fromAddresses[i];
            onProgress?.({
                current: i,
                total: fromAddresses.length,
                message: `Searching: ${fromAddr} (${i + 1}/${fromAddresses.length})`,
            });

            for (const folder of searchableFolders) {
                try {
                    const lock = await client.getMailboxLock(folder);
                    try {
                        const allUids = await client.search({ from: fromAddr }, { uid: true });
                        if (!allUids || allUids.length === 0) continue;

                        let toTrashUids: number[] = allUids;
                        if (deleteSettings.excludeImportant || deleteSettings.excludeStarred) {
                            const flaggedUids = await client.search({ from: fromAddr, flagged: true }, { uid: true });
                            const flaggedSet = new Set(flaggedUids || []);
                            toTrashUids = allUids.filter(uid => !flaggedSet.has(uid));
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
                    } finally {
                        lock.release();
                    }
                } catch (e) {
                    console.error(`[IMAP] searchAndTrashByFrom error in folder ${folder}:`, e);
                }
            }

            onProgress?.({
                current: i + 1,
                total: fromAddresses.length,
                message: `Done: ${fromAddr} (${i + 1}/${fromAddresses.length})`,
            });
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
            .filter(mb => !mb.specialUse || (mb.specialUse !== '\\Trash' && mb.specialUse !== '\\Junk'))
            .map(mb => mb.path);

        for (let i = 0; i < subjects.length; i++) {
            const subj = subjects[i];
            onProgress?.({
                current: i,
                total: subjects.length,
                message: `Searching: "${subj}" (${i + 1}/${subjects.length})`,
            });

            for (const folder of searchableFolders) {
                try {
                    const lock = await client.getMailboxLock(folder);
                    try {
                        const allUids = await client.search({ subject: subj }, { uid: true });
                        if (!allUids || allUids.length === 0) continue;

                        let toTrashUids: number[] = allUids;
                        if (deleteSettings.excludeImportant || deleteSettings.excludeStarred) {
                            const flaggedUids = await client.search({ subject: subj, flagged: true }, { uid: true });
                            const flaggedSet = new Set(flaggedUids || []);
                            toTrashUids = allUids.filter(uid => !flaggedSet.has(uid));
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
                    } finally {
                        lock.release();
                    }
                } catch (e) {
                    console.error(`[IMAP] searchAndTrashBySubject error in folder ${folder}:`, e);
                }
            }

            onProgress?.({
                current: i + 1,
                total: subjects.length,
                message: `Done: "${subj}" (${i + 1}/${subjects.length})`,
            });
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

// Re-export shared functions
export { getCachedResult };
