import { ipcMain, BrowserWindow, dialog } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import * as settingsManager from '../services/settings-manager';
import * as accountManager from '../services/account-manager';
import * as gmailService from '../services/gmail-service';
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
} from '../../shared/types';
import path from 'path';
import fs from 'fs/promises';

let mainWindow: BrowserWindow | null = null;
const detailWindows = new Map<string, BrowserWindow>();
const detailWindowData = new Map<number, DetailWindowData>();

export function setMainWindowRef(win: BrowserWindow | null) {
    mainWindow = win;
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
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.fetchLabels(accountId, gcpSettings.clientId, gcpSettings.clientSecret);
    });
    ipcMain.handle(IPC_CHANNELS.ACCOUNTS_GET_CONNECTION_STATUS, async (_e, accountId: string) => {
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.checkConnection(accountId, gcpSettings.clientId, gcpSettings.clientSecret);
    });

    // --- Gmail ---
    ipcMain.handle(IPC_CHANNELS.GMAIL_FETCH_EMAILS, async (_e, options: FetchEmailsOptions) => {
        const gcpSettings = await settingsManager.getGcpSettings();
        const labelSelection = await accountManager.getSelectedLabels(options.accountId);
        return gmailService.fetchEmails(
            options,
            gcpSettings.clientId,
            gcpSettings.clientSecret,
            labelSelection.selectedLabelIds,
            progress => {
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send(IPC_CHANNELS.EVENT_FETCH_PROGRESS, progress);
                }
            }
        );
    });
    ipcMain.handle(IPC_CHANNELS.GMAIL_GET_EMAIL_BODY, async (_e, accountId: string, messageId: string) => {
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.getEmailBody(accountId, messageId, gcpSettings.clientId, gcpSettings.clientSecret);
    });
    ipcMain.handle(IPC_CHANNELS.GMAIL_GET_EMAIL_BODY_PARTS, async (_e, accountId: string, messageId: string) => {
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.getEmailBodyParts(accountId, messageId, gcpSettings.clientId, gcpSettings.clientSecret);
    });
    ipcMain.handle(IPC_CHANNELS.GMAIL_GET_EMAIL_RAW, async (_e, accountId: string, messageId: string) => {
        const gcpSettings = await settingsManager.getGcpSettings();
        return gmailService.getEmailRaw(accountId, messageId, gcpSettings.clientId, gcpSettings.clientSecret);
    });
    ipcMain.handle(
        IPC_CHANNELS.GMAIL_BULK_DELETE_BY_FROM,
        async (_e, accountId: string, fromAddresses: string[]): Promise<DeleteResult> => {
            const gcpSettings = await settingsManager.getGcpSettings();
            const deleteSettings = await settingsManager.getDeleteSettings();
            return gmailService.searchAndTrashByFrom(
                accountId,
                fromAddresses,
                deleteSettings,
                gcpSettings.clientId,
                gcpSettings.clientSecret,
                progress => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send(IPC_CHANNELS.EVENT_FETCH_PROGRESS, progress);
                    }
                }
            );
        }
    );
    ipcMain.handle(IPC_CHANNELS.GMAIL_GET_CACHED_RESULT, (_e, accountId: string, mode?: string) =>
        gmailService.getCachedResult(accountId, (mode as 'days' | 'range') || 'days')
    );

    // --- Ollama ---
    ipcMain.handle(IPC_CHANNELS.OLLAMA_TEST_CONNECTION, (_e, host: string) => ollamaService.testConnection(host));
    ipcMain.handle(IPC_CHANNELS.OLLAMA_GET_MODELS, (_e, host: string) => ollamaService.getModels(host));
    ipcMain.handle(
        IPC_CHANNELS.OLLAMA_RUN_JUDGMENT,
        async (_e, accountId: string, messageIds: string[], mode?: string) => {
            const fetchMode = (mode as 'days' | 'range') || 'days';
            const gcpSettings = await settingsManager.getGcpSettings();
            const cached = await gmailService.getCachedResult(accountId, fetchMode);
            if (!cached) throw new Error('No cached result');
            const targetMessages = cached.result.messages.filter(m => messageIds.includes(m.id));
            const judgments = await ollamaService.runAIJudgment(
                targetMessages,
                async (msgId: string) => {
                    return gmailService.getEmailBodyParts(
                        accountId,
                        msgId,
                        gcpSettings.clientId,
                        gcpSettings.clientSecret
                    );
                },
                progress => {
                    if (mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send(IPC_CHANNELS.EVENT_AI_PROGRESS, progress);
                    }
                }
            );
            // Save AI judgments to the mode-specific sampling cache
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

    // --- App state ---
    ipcMain.handle(IPC_CHANNELS.STATE_GET, () => stateManager.getAppState());
    ipcMain.handle(IPC_CHANNELS.STATE_SAVE, (_e, state) => stateManager.saveAppState(state));
}
