import { ipcMain, BrowserWindow, dialog } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import * as settingsManager from '../services/settings-manager';
import * as accountManager from '../services/account-manager';
import * as gmailService from '../services/gmail-service';
import * as imapService from '../services/imap-service';
import * as ollamaService from '../services/ollama-service';
import * as stateManager from '../services/state-manager';
import { deleteDir } from '../services/file-manager';
import { getAccountCacheDir } from '../../shared/constants';
import type {
    GeneralSettings,
    FetchSettings,
    DeleteSettings,
    OllamaSettings,
    AIJudgmentSettings,
    GcpSettings,
    AccountLabelSelection,
    FetchEmailsOptions,
    DetailWindowData,
    DeleteResult,
    MailProviderId,
    ImapConnectionSettings,
    AccountRules,
    RuleLine,
    TrashWindowData,
    EmptyTrashResult,
    RuleGroup,
} from '../../shared/types';
import { parseRuleText } from '../services/rule-parser';
import { buildRuleGroups } from '../services/rule-matcher';
import path from 'path';
import fs from 'fs/promises';

let mainWindow: BrowserWindow | null = null;
const detailWindows = new Map<string, BrowserWindow>();
const detailWindowData = new Map<number, DetailWindowData>();
const trashWindows = new Map<string, BrowserWindow>();
const trashWindowData = new Map<number, TrashWindowData>();

export function setMainWindowRef(win: BrowserWindow | null) {
    mainWindow = win;
}

/**
 * Throttle IPC progress events to avoid flooding the renderer (prevents React "Maximum update depth exceeded").
 * Always delivers the last call (trailing) so the final state is never lost.
 */
function throttledProgress(channel: string, intervalMs = 500) {
    let lastSent = 0;
    let pending: unknown = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (progress: unknown) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const now = Date.now();
        if (now - lastSent >= intervalMs) {
            lastSent = now;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            mainWindow.webContents.send(channel, progress);
        } else {
            pending = progress;
            if (!timer) {
                timer = setTimeout(
                    () => {
                        timer = null;
                        if (pending !== null && mainWindow && !mainWindow.isDestroyed()) {
                            lastSent = Date.now();
                            mainWindow.webContents.send(channel, pending);
                            pending = null;
                        }
                    },
                    intervalMs - (now - lastSent)
                );
            }
        }
    };
}

async function getAccountProvider(accountId: string): Promise<MailProviderId> {
    const accounts = await accountManager.getAllAccounts();
    const account = accounts.find(a => a.id === accountId);
    if (!account) throw new Error('Account not found');
    return account.provider;
}

async function requireImapSettings(accountId: string) {
    const settings = await accountManager.getImapSettings(accountId);
    if (!settings) throw new Error('IMAP settings not found');
    return settings;
}

export function registerAllIpcHandlers() {
    // --- Settings ---
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_GENERAL, () => settingsManager.getGeneralSettings());
    ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_GENERAL, (_e, settings: GeneralSettings) =>
        settingsManager.saveGeneralSettings(settings)
    );
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_FETCH, () => settingsManager.getFetchSettings());
    ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_FETCH, (_e, settings: FetchSettings) =>
        settingsManager.saveFetchSettings(settings)
    );
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_DELETE, () => settingsManager.getDeleteSettings());
    ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_DELETE, (_e, settings: DeleteSettings) =>
        settingsManager.saveDeleteSettings(settings)
    );
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_OLLAMA, () => settingsManager.getOllamaSettings());
    ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_OLLAMA, (_e, settings: OllamaSettings) =>
        settingsManager.saveOllamaSettings(settings)
    );
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_AI_JUDGMENT, () => settingsManager.getAIJudgmentSettings());
    ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_AI_JUDGMENT, (_e, settings: AIJudgmentSettings) =>
        settingsManager.saveAIJudgmentSettings(settings)
    );
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_GCP, () => settingsManager.getGcpSettings());
    ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_GCP, (_e, settings: GcpSettings) =>
        settingsManager.saveGcpSettings(settings)
    );

    // GCP JSON import
    ipcMain.handle(IPC_CHANNELS.SETTINGS_IMPORT_GCP_JSON, async () => {
        const result = await dialog.showOpenDialog({
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile'],
        });
        if (result.canceled || result.filePaths.length === 0) return null;
        try {
            const content = await fs.readFile(result.filePaths[0], 'utf-8');
            const json = JSON.parse(content);
            // Try different JSON structures (web, installed, or direct)
            const installed = json.installed || json.web || json;
            const gcpSettings: GcpSettings = {
                clientId: installed.client_id || '',
                clientSecret: installed.client_secret || '',
                projectId: installed.project_id || '',
            };
            if (!gcpSettings.clientId || !gcpSettings.clientSecret) {
                throw new Error('Missing client_id or client_secret');
            }
            return gcpSettings;
        } catch (e: any) {
            throw new Error(`Invalid GCP JSON: ${e.message}`);
        }
    });

    // --- Accounts ---
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET_ALL, () => accountManager.getAllAccounts());
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_ADD, async () => {
        const gcpSettings = await settingsManager.getGcpSettings();
        if (!gcpSettings.clientId || !gcpSettings.clientSecret) {
            throw new Error('GCP settings not configured');
        }
        const result = await gmailService.startOAuthFlow(gcpSettings.clientId, gcpSettings.clientSecret);
        if (!result) return null;
        const account = await accountManager.createAccount(result.email, result.displayName, result.tokens);
        return account;
    });
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_REMOVE, (_e, accountId: string) => accountManager.removeAccount(accountId));
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET_LABELS, async (_e, accountId: string) => {
        const provider = await getAccountProvider(accountId);
        if (provider === 'imap') {
            const imapSettings = await requireImapSettings(accountId);
            return imapService.fetchFolders(imapSettings);
        }
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.fetchLabels(accountId, gcpSettings.clientId, gcpSettings.clientSecret);
    });
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET_SELECTED_LABELS, (_e, accountId: string) =>
        accountManager.getSelectedLabels(accountId)
    );
    ipcMain.handle(
        IPC_CHANNELS.ACCOUNTS_SAVE_SELECTED_LABELS,
        (_e, accountId: string, selection: AccountLabelSelection) =>
            accountManager.saveSelectedLabels(accountId, selection)
    );
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_REFRESH_LABELS, async (_e, accountId: string) => {
        const provider = await getAccountProvider(accountId);
        if (provider === 'imap') {
            const imapSettings = await requireImapSettings(accountId);
            return imapService.fetchFolders(imapSettings);
        }
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.fetchLabels(accountId, gcpSettings.clientId, gcpSettings.clientSecret);
    });
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET_CONNECTION_STATUS, async (_e, accountId: string) => {
        const provider = await getAccountProvider(accountId);
        if (provider === 'imap') {
            const imapSettings = await requireImapSettings(accountId);
            return imapService.checkConnection(imapSettings);
        }
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.checkConnection(accountId, gcpSettings.clientId, gcpSettings.clientSecret);
    });

    // --- IMAP accounts ---
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_ADD_IMAP, async (_e, settings: ImapConnectionSettings) => {
        const ok = await imapService.checkConnection(settings);
        if (!ok) throw new Error('IMAP connection failed');
        const email = settings.username.includes('@') ? settings.username : `${settings.username}@${settings.host}`;
        const displayName = email;
        return accountManager.createImapAccount(email, displayName, settings);
    });
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_TEST_IMAP, (_e, settings: ImapConnectionSettings) =>
        imapService.checkConnection(settings)
    );
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET_IMAP_SETTINGS, (_e, accountId: string) =>
        accountManager.getImapSettings(accountId)
    );
    ipcMain.handle(
        IPC_CHANNELS.ACCOUNTS_UPDATE_IMAP,
        async (_e, accountId: string, settings: ImapConnectionSettings) => {
            const ok = await imapService.checkConnection(settings);
            if (!ok) throw new Error('IMAP connection failed');
            await accountManager.saveImapSettings(accountId, settings);
            const email = settings.username.includes('@') ? settings.username : `${settings.username}@${settings.host}`;
            await accountManager.updateAccountProfile(accountId, { email, displayName: email });
            return true;
        }
    );
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET_RULES, (_e, accountId: string) =>
        accountManager.getAccountRules(accountId)
    );
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_SAVE_RULES, async (_e, accountId: string, rules: AccountRules) => {
        // Re-parse to ensure lines are up to date
        const parsed = parseRuleText(rules.ruleText);
        await accountManager.saveAccountRules(accountId, parsed);
    });

    // --- Mail ---
    ipcMain.handle(IPC_CHANNELS.MAIL_FETCH_EMAILS, async (_e, options: FetchEmailsOptions) => {
        const provider = await getAccountProvider(options.accountId);
        const labelSelection = await accountManager.getSelectedLabels(options.accountId);
        const onProgress = throttledProgress(IPC_CHANNELS.EVENT_FETCH_PROGRESS);
        if (provider === 'imap') {
            const imapSettings = await requireImapSettings(options.accountId);
            return imapService.fetchEmails(options, imapSettings, labelSelection.selectedLabelIds, onProgress);
        }
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.fetchEmails(
            options,
            gcpSettings.clientId,
            gcpSettings.clientSecret,
            labelSelection.selectedLabelIds,
            onProgress
        );
    });
    ipcMain.handle(IPC_CHANNELS.MAIL_CANCEL_FETCH, async _e => {
        gmailService.cancelFetch();
        imapService.cancelFetch();
    });
    // Body/BodyParts/Raw: all read from sampling cache (no provider connection)
    ipcMain.handle(IPC_CHANNELS.MAIL_GET_EMAIL_BODY, async (_e, accountId: string, messageId: string) => {
        const provider = await getAccountProvider(accountId);
        if (provider === 'imap') return imapService.getEmailBody(accountId, messageId);
        return gmailService.getEmailBody(accountId, messageId);
    });
    ipcMain.handle(IPC_CHANNELS.MAIL_GET_EMAIL_BODY_PARTS, async (_e, accountId: string, messageId: string) => {
        const provider = await getAccountProvider(accountId);
        if (provider === 'imap') {
            const cached = await imapService.getEmailBodyParts(accountId, messageId);
            if (cached.html || cached.plain) return cached;
            const imapSettings = await requireImapSettings(accountId);
            return imapService.getEmailBodyPartsLive(imapSettings, messageId);
        }
        const cached = await gmailService.getEmailBodyParts(accountId, messageId);
        if (cached.html || cached.plain) return cached;
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.getEmailBodyPartsLive(accountId, gcpSettings.clientId, gcpSettings.clientSecret, messageId);
    });
    ipcMain.handle(IPC_CHANNELS.MAIL_GET_EMAIL_RAW, async (_e, accountId: string, messageId: string) => {
        const provider = await getAccountProvider(accountId);
        if (provider === 'imap') {
            const cached = await imapService.getEmailRaw(accountId, messageId);
            if (cached) return cached;
            const imapSettings = await requireImapSettings(accountId);
            return imapService.getEmailRawLive(imapSettings, messageId);
        }
        const cached = await gmailService.getEmailRaw(accountId, messageId);
        if (cached) return cached;
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.getEmailRawLive(accountId, gcpSettings.clientId, gcpSettings.clientSecret, messageId);
    });
    ipcMain.handle(
        IPC_CHANNELS.MAIL_BULK_DELETE_BY_FROM,
        async (_e, accountId: string, fromAddresses: string[]): Promise<DeleteResult> => {
            const deleteSettings = await settingsManager.getDeleteSettings();
            const onProgress = throttledProgress(IPC_CHANNELS.EVENT_FETCH_PROGRESS);
            const provider = await getAccountProvider(accountId);
            if (provider === 'imap') {
                const imapSettings = await requireImapSettings(accountId);
                return imapService.searchAndTrashByFrom(imapSettings, fromAddresses, deleteSettings, onProgress);
            }
            const gcpSettings = await settingsManager.getGcpSettings();
            return gmailService.searchAndTrashByFrom(
                accountId,
                fromAddresses,
                deleteSettings,
                gcpSettings.clientId,
                gcpSettings.clientSecret,
                onProgress
            );
        }
    );
    ipcMain.handle(
        IPC_CHANNELS.MAIL_DELETE_BY_MESSAGE_IDS,
        async (_e, accountId: string, messageIds: string[]): Promise<DeleteResult> => {
            const onProgress = throttledProgress(IPC_CHANNELS.EVENT_FETCH_PROGRESS);
            const provider = await getAccountProvider(accountId);
            if (provider === 'imap') {
                const imapSettings = await requireImapSettings(accountId);
                return imapService.trashByMessageIds(imapSettings, messageIds, onProgress);
            }
            const gcpSettings = await settingsManager.getGcpSettings();
            return gmailService.trashByMessageIds(
                accountId,
                messageIds,
                gcpSettings.clientId,
                gcpSettings.clientSecret,
                onProgress
            );
        }
    );
    ipcMain.handle(
        IPC_CHANNELS.MAIL_BULK_DELETE_BY_SUBJECT,
        async (_e, accountId: string, subjects: string[]): Promise<DeleteResult> => {
            const deleteSettings = await settingsManager.getDeleteSettings();
            const onProgress = throttledProgress(IPC_CHANNELS.EVENT_FETCH_PROGRESS);
            const provider = await getAccountProvider(accountId);
            if (provider === 'imap') {
                const imapSettings = await requireImapSettings(accountId);
                return imapService.searchAndTrashBySubject(imapSettings, subjects, deleteSettings, onProgress);
            }
            const gcpSettings = await settingsManager.getGcpSettings();
            return gmailService.searchAndTrashBySubject(
                accountId,
                subjects,
                deleteSettings,
                gcpSettings.clientId,
                gcpSettings.clientSecret,
                onProgress
            );
        }
    );
    ipcMain.handle(
        IPC_CHANNELS.MAIL_BULK_DELETE_BY_RULE,
        async (_e, accountId: string, ruleLines: RuleLine[]): Promise<DeleteResult> => {
            const deleteSettings = await settingsManager.getDeleteSettings();
            const onProgress = throttledProgress(IPC_CHANNELS.EVENT_FETCH_PROGRESS);
            const provider = await getAccountProvider(accountId);
            if (provider === 'imap') {
                const imapSettings = await requireImapSettings(accountId);
                return imapService.searchAndTrashByRule(imapSettings, ruleLines, deleteSettings, onProgress);
            }
            const gcpSettings = await settingsManager.getGcpSettings();
            return gmailService.searchAndTrashByRule(
                accountId,
                ruleLines,
                deleteSettings,
                gcpSettings.clientId,
                gcpSettings.clientSecret,
                onProgress
            );
        }
    );
    ipcMain.handle(
        IPC_CHANNELS.MAIL_BUILD_RULE_GROUPS,
        async (_e, accountId: string, mode?: string): Promise<RuleGroup[]> => {
            const fetchMode = (mode as 'days' | 'range') || 'days';
            const cached = await gmailService.getCachedResult(accountId, fetchMode);
            if (!cached) return [];

            const rules = await accountManager.getAccountRules(accountId);
            if (rules.lines.length === 0) return [];

            const periodDays = Math.max(
                1,
                Math.round(
                    (new Date(cached.result.periodEnd).getTime() - new Date(cached.result.periodStart).getTime()) /
                        86400000
                )
            );

            return buildRuleGroups(cached.result.messages, cached.result.bodyParts || {}, rules, periodDays);
        }
    );
    ipcMain.handle(IPC_CHANNELS.MAIL_GET_CACHED_RESULT, (_e, accountId: string, mode?: string) =>
        gmailService.getCachedResult(accountId, (mode as 'days' | 'range') || 'days')
    );

    // --- Ollama ---
    ipcMain.handle(IPC_CHANNELS.OLLAMA_TEST_CONNECTION, (_e, host: string) => ollamaService.testConnection(host));
    ipcMain.handle(IPC_CHANNELS.OLLAMA_GET_MODELS, (_e, host: string) => ollamaService.getModels(host));
    ipcMain.handle(
        IPC_CHANNELS.OLLAMA_RUN_JUDGMENT,
        async (_e, accountId: string, messageIds: string[], mode?: string) => {
            const fetchMode = (mode as 'days' | 'range') || 'days';
            const provider = await getAccountProvider(accountId);
            const cached = await gmailService.getCachedResult(accountId, fetchMode);
            if (!cached) throw new Error('No cached result');
            const targetMessages = cached.result.messages.filter(m => messageIds.includes(m.id));
            const getBodyParts =
                provider === 'imap'
                    ? (msgId: string) => imapService.getEmailBodyParts(accountId, msgId)
                    : (msgId: string) => gmailService.getEmailBodyParts(accountId, msgId);
            const getRaw =
                provider === 'imap'
                    ? (msgId: string) => imapService.getEmailRaw(accountId, msgId)
                    : (msgId: string) => gmailService.getEmailRaw(accountId, msgId);
            const onProgress = throttledProgress(IPC_CHANNELS.EVENT_AI_PROGRESS);
            const judgments = await ollamaService.runAIJudgment(targetMessages, getBodyParts, getRaw, onProgress);
            await gmailService.updateCachedResultWithAI(accountId, fetchMode, judgments);
        }
    );
    ipcMain.handle(IPC_CHANNELS.OLLAMA_CANCEL_JUDGMENT, () => ollamaService.cancelAIJudgment());

    // --- Data management ---
    ipcMain.handle(IPC_CHANNELS.DATA_CLEAR_AI_CACHE, () => ollamaService.clearAICache());
    ipcMain.handle(IPC_CHANNELS.DATA_CLEAR_ALL_CACHE, async () => {
        await ollamaService.clearAICache();
        const accounts = await accountManager.getAllAccounts();
        for (const acct of accounts) {
            await deleteDir(getAccountCacheDir(acct.id));
        }
    });
    ipcMain.handle(IPC_CHANNELS.DATA_EXPORT_SETTINGS, () => settingsManager.exportAllSettings());
    ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_SETTINGS, (_e, json: string) => settingsManager.importAllSettings(json));
    ipcMain.handle(IPC_CHANNELS.DATA_EXPORT_ACCOUNT_DATA, () => accountManager.exportAccountData());
    ipcMain.handle(IPC_CHANNELS.DATA_IMPORT_ACCOUNT_DATA, (_e, json: string) => accountManager.importAccountData(json));
    ipcMain.handle(IPC_CHANNELS.DATA_SAVE_FILE, async (_e, content: string, defaultName: string) => {
        const result = await dialog.showSaveDialog({
            defaultPath: defaultName,
            filters: [{ name: 'JSON', extensions: ['json'] }],
        });
        if (result.canceled || !result.filePath) return false;
        await fs.writeFile(result.filePath, content, 'utf-8');
        return true;
    });

    // --- Detail window ---
    ipcMain.handle(IPC_CHANNELS.DETAIL_OPEN, async (_e, data: DetailWindowData) => {
        const existing = detailWindows.get(data.fromAddress);
        if (existing && !existing.isDestroyed()) {
            existing.focus();
            return;
        }

        const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
        const detailWindow = new BrowserWindow({
            width: 800,
            height: 600,
            title: `${data.fromAddress} (${data.messages.length})`,
            frame: false,
            titleBarStyle: 'hidden',
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, '../../preload/index.js'),
            },
        });

        detailWindowData.set(detailWindow.id, data);
        detailWindows.set(data.fromAddress, detailWindow);

        if (isDev) {
            detailWindow.loadURL('http://localhost:3001?detail=1');
        } else {
            detailWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
                query: { detail: '1' },
            });
        }

        detailWindow.on('closed', () => {
            detailWindowData.delete(detailWindow.id);
            detailWindows.delete(data.fromAddress);
        });
    });

    ipcMain.handle(IPC_CHANNELS.DETAIL_GET_DATA, e => {
        const win = BrowserWindow.fromWebContents(e.sender);
        if (!win) return null;
        return detailWindowData.get(win.id) || null;
    });

    // --- Trash window ---
    ipcMain.handle(IPC_CHANNELS.TRASH_OPEN, async (_e, accountId: string) => {
        const existing = trashWindows.get(accountId);
        if (existing && !existing.isDestroyed()) {
            existing.focus();
            return;
        }

        const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
        const trashWindow = new BrowserWindow({
            width: 900,
            height: 700,
            title: 'Trash',
            frame: false,
            titleBarStyle: 'hidden',
            autoHideMenuBar: true,
            webPreferences: {
                preload: path.join(__dirname, '../../preload/index.js'),
            },
        });

        trashWindowData.set(trashWindow.id, { accountId, messages: [] });
        trashWindows.set(accountId, trashWindow);

        if (isDev) {
            trashWindow.loadURL('http://localhost:3001?trash=1');
        } else {
            trashWindow.loadFile(path.join(__dirname, '../../renderer/index.html'), {
                query: { trash: '1' },
            });
        }

        trashWindow.on('closed', () => {
            trashWindowData.delete(trashWindow.id);
            trashWindows.delete(accountId);
        });
    });

    ipcMain.handle(IPC_CHANNELS.TRASH_GET_DATA, e => {
        const win = BrowserWindow.fromWebContents(e.sender);
        if (!win) return null;
        return trashWindowData.get(win.id) || null;
    });

    ipcMain.handle(IPC_CHANNELS.TRASH_FETCH, async (_e, accountId: string) => {
        const onProgress = throttledProgress(IPC_CHANNELS.EVENT_FETCH_PROGRESS);
        const provider = await getAccountProvider(accountId);
        if (provider === 'imap') {
            const imapSettings = await requireImapSettings(accountId);
            return imapService.fetchTrashEmails(imapSettings, onProgress);
        }
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.fetchTrashEmails(accountId, gcpSettings.clientId, gcpSettings.clientSecret, onProgress);
    });

    ipcMain.handle(IPC_CHANNELS.TRASH_EMPTY, async (_e, accountId: string): Promise<EmptyTrashResult> => {
        const onProgress = throttledProgress(IPC_CHANNELS.EVENT_FETCH_PROGRESS);
        const provider = await getAccountProvider(accountId);
        if (provider === 'imap') {
            const imapSettings = await requireImapSettings(accountId);
            return imapService.emptyTrash(imapSettings, onProgress);
        }
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.emptyTrash(accountId, gcpSettings.clientId, gcpSettings.clientSecret, onProgress);
    });

    ipcMain.handle(
        IPC_CHANNELS.TRASH_DELETE_SELECTED,
        async (_e, accountId: string, messageIds: string[]): Promise<EmptyTrashResult> => {
            const onProgress = throttledProgress(IPC_CHANNELS.EVENT_FETCH_PROGRESS);
            const provider = await getAccountProvider(accountId);
            if (provider === 'imap') {
                const imapSettings = await requireImapSettings(accountId);
                return imapService.deleteTrashMessages(imapSettings, messageIds, onProgress);
            }
            const gcpSettings = await settingsManager.getGcpSettings();
            return gmailService.deleteTrashMessages(
                accountId,
                messageIds,
                gcpSettings.clientId,
                gcpSettings.clientSecret,
                onProgress
            );
        }
    );

    // --- App state ---
    ipcMain.handle(IPC_CHANNELS.STATE_GET, () => stateManager.getAppState());
    ipcMain.handle(IPC_CHANNELS.STATE_SAVE, (_e, state) => stateManager.saveAppState(state));
}
