import { contextBridge, ipcRenderer } from 'electron';
import type { IpcApi } from '../shared/ipc';

// IPCチャンネル定義（ランタイムでsharedからインポートを避けるためローカルコピー）
const CH = {
    APP_GET_INFO: 'app:getInfo',
    APP_SET_THEME: 'app:setTheme',
    APP_SET_LANGUAGE: 'app:setLanguage',
    WINDOW_MINIMIZE: 'window:minimize',
    WINDOW_MAXIMIZE_OR_RESTORE: 'window:maximizeOrRestore',
    WINDOW_CLOSE: 'window:close',
    WINDOW_IS_MAXIMIZED: 'window:isMaximized',
    MAIN_CONSOLE: 'main:console',
    SETTINGS_GET_GENERAL: 'settings:getGeneral',
    SETTINGS_SAVE_GENERAL: 'settings:saveGeneral',
    SETTINGS_GET_FETCH: 'settings:getFetch',
    SETTINGS_SAVE_FETCH: 'settings:saveFetch',
    SETTINGS_GET_DELETE: 'settings:getDelete',
    SETTINGS_SAVE_DELETE: 'settings:saveDelete',
    SETTINGS_GET_OLLAMA: 'settings:getOllama',
    SETTINGS_SAVE_OLLAMA: 'settings:saveOllama',
    SETTINGS_GET_AI_JUDGMENT: 'settings:getAIJudgment',
    SETTINGS_SAVE_AI_JUDGMENT: 'settings:saveAIJudgment',
    SETTINGS_GET_GCP: 'settings:getGcp',
    SETTINGS_SAVE_GCP: 'settings:saveGcp',
    SETTINGS_IMPORT_GCP_JSON: 'settings:importGcpJson',
    ACCOUNTS_GET_ALL: 'accounts:getAll',
    ACCOUNTS_ADD: 'accounts:add',
    ACCOUNTS_REMOVE: 'accounts:remove',
    ACCOUNTS_GET_LABELS: 'accounts:getLabels',
    ACCOUNTS_GET_SELECTED_LABELS: 'accounts:getSelectedLabels',
    ACCOUNTS_SAVE_SELECTED_LABELS: 'accounts:saveSelectedLabels',
    ACCOUNTS_REFRESH_LABELS: 'accounts:refreshLabels',
    ACCOUNTS_GET_CONNECTION_STATUS: 'accounts:getConnectionStatus',
    ACCOUNTS_ADD_IMAP: 'accounts:addImap',
    ACCOUNTS_TEST_IMAP: 'accounts:testImap',
    ACCOUNTS_GET_IMAP_SETTINGS: 'accounts:getImapSettings',
    ACCOUNTS_UPDATE_IMAP: 'accounts:updateImap',
    ACCOUNTS_GET_RULES: 'accounts:getRules',
    ACCOUNTS_SAVE_RULES: 'accounts:saveRules',
    MAIL_FETCH_EMAILS: 'mail:fetchEmails',
    MAIL_CANCEL_FETCH: 'mail:cancelFetch',
    MAIL_GET_EMAIL_BODY: 'mail:getEmailBody',
    MAIL_GET_EMAIL_BODY_PARTS: 'mail:getEmailBodyParts',
    MAIL_GET_EMAIL_RAW: 'mail:getEmailRaw',
    MAIL_BULK_DELETE_BY_FROM: 'mail:bulkDeleteByFrom',
    MAIL_DELETE_BY_MESSAGE_IDS: 'mail:deleteByMessageIds',
    MAIL_BULK_DELETE_BY_SUBJECT: 'mail:bulkDeleteBySubject',
    MAIL_BULK_DELETE_BY_RULE: 'mail:bulkDeleteByRule',
    MAIL_BUILD_RULE_GROUPS: 'mail:buildRuleGroups',
    MAIL_GET_CACHED_RESULT: 'mail:getCachedResult',
    OLLAMA_TEST_CONNECTION: 'ollama:testConnection',
    OLLAMA_GET_MODELS: 'ollama:getModels',
    OLLAMA_RUN_JUDGMENT: 'ollama:runJudgment',
    OLLAMA_CANCEL_JUDGMENT: 'ollama:cancelJudgment',
    DATA_CLEAR_AI_CACHE: 'data:clearAiCache',
    DATA_CLEAR_ALL_CACHE: 'data:clearAllCache',
    DATA_EXPORT_SETTINGS: 'data:exportSettings',
    DATA_IMPORT_SETTINGS: 'data:importSettings',
    DATA_EXPORT_ACCOUNT_DATA: 'data:exportAccountData',
    DATA_IMPORT_ACCOUNT_DATA: 'data:importAccountData',
    DETAIL_OPEN: 'detail:open',
    DETAIL_GET_DATA: 'detail:getData',
    TRASH_OPEN: 'trash:open',
    TRASH_GET_DATA: 'trash:getData',
    TRASH_FETCH: 'trash:fetch',
    TRASH_EMPTY: 'trash:empty',
    TRASH_DELETE_SELECTED: 'trash:deleteSelected',
    EVENT_FETCH_PROGRESS: 'event:fetchProgress',
    EVENT_AI_PROGRESS: 'event:aiProgress',
    EVENT_DETAIL_DATA: 'event:detailData',
    STATE_GET: 'state:get',
    STATE_SAVE: 'state:save',
} as const;

const api: IpcApi = {
    // App
    getAppInfo: () => ipcRenderer.invoke(CH.APP_GET_INFO),
    setTheme: theme => ipcRenderer.invoke(CH.APP_SET_THEME, theme),
    setLanguage: language => ipcRenderer.invoke(CH.APP_SET_LANGUAGE, language),

    // Window
    minimize: () => ipcRenderer.invoke(CH.WINDOW_MINIMIZE),
    maximizeOrRestore: () => ipcRenderer.invoke(CH.WINDOW_MAXIMIZE_OR_RESTORE),
    isMaximized: () => ipcRenderer.invoke(CH.WINDOW_IS_MAXIMIZED),
    close: () => ipcRenderer.invoke(CH.WINDOW_CLOSE),

    // Settings
    getGeneralSettings: () => ipcRenderer.invoke(CH.SETTINGS_GET_GENERAL),
    saveGeneralSettings: s => ipcRenderer.invoke(CH.SETTINGS_SAVE_GENERAL, s),
    getFetchSettings: () => ipcRenderer.invoke(CH.SETTINGS_GET_FETCH),
    saveFetchSettings: s => ipcRenderer.invoke(CH.SETTINGS_SAVE_FETCH, s),
    getDeleteSettings: () => ipcRenderer.invoke(CH.SETTINGS_GET_DELETE),
    saveDeleteSettings: s => ipcRenderer.invoke(CH.SETTINGS_SAVE_DELETE, s),
    getOllamaSettings: () => ipcRenderer.invoke(CH.SETTINGS_GET_OLLAMA),
    saveOllamaSettings: s => ipcRenderer.invoke(CH.SETTINGS_SAVE_OLLAMA, s),
    getAIJudgmentSettings: () => ipcRenderer.invoke(CH.SETTINGS_GET_AI_JUDGMENT),
    saveAIJudgmentSettings: s => ipcRenderer.invoke(CH.SETTINGS_SAVE_AI_JUDGMENT, s),
    getGcpSettings: () => ipcRenderer.invoke(CH.SETTINGS_GET_GCP),
    saveGcpSettings: s => ipcRenderer.invoke(CH.SETTINGS_SAVE_GCP, s),
    importGcpJson: () => ipcRenderer.invoke(CH.SETTINGS_IMPORT_GCP_JSON),

    // Accounts
    getAccounts: () => ipcRenderer.invoke(CH.ACCOUNTS_GET_ALL),
    addAccount: () => ipcRenderer.invoke(CH.ACCOUNTS_ADD),
    removeAccount: id => ipcRenderer.invoke(CH.ACCOUNTS_REMOVE, id),
    getLabels: id => ipcRenderer.invoke(CH.ACCOUNTS_GET_LABELS, id),
    getSelectedLabels: id => ipcRenderer.invoke(CH.ACCOUNTS_GET_SELECTED_LABELS, id),
    saveSelectedLabels: (id, s) => ipcRenderer.invoke(CH.ACCOUNTS_SAVE_SELECTED_LABELS, id, s),
    refreshLabels: id => ipcRenderer.invoke(CH.ACCOUNTS_REFRESH_LABELS, id),
    getConnectionStatus: id => ipcRenderer.invoke(CH.ACCOUNTS_GET_CONNECTION_STATUS, id),
    addImapAccount: settings => ipcRenderer.invoke(CH.ACCOUNTS_ADD_IMAP, settings),
    testImapConnection: settings => ipcRenderer.invoke(CH.ACCOUNTS_TEST_IMAP, settings),
    getImapSettings: accountId => ipcRenderer.invoke(CH.ACCOUNTS_GET_IMAP_SETTINGS, accountId),
    updateImapSettings: (accountId, settings) => ipcRenderer.invoke(CH.ACCOUNTS_UPDATE_IMAP, accountId, settings),
    getAccountRules: accountId => ipcRenderer.invoke(CH.ACCOUNTS_GET_RULES, accountId),
    saveAccountRules: (accountId, rules) => ipcRenderer.invoke(CH.ACCOUNTS_SAVE_RULES, accountId, rules),

    // Mail
    fetchEmails: options => ipcRenderer.invoke(CH.MAIL_FETCH_EMAILS, options),
    cancelFetch: () => ipcRenderer.invoke(CH.MAIL_CANCEL_FETCH),
    getEmailBody: (accountId, messageId) => ipcRenderer.invoke(CH.MAIL_GET_EMAIL_BODY, accountId, messageId),
    getEmailBodyParts: (accountId, messageId) => ipcRenderer.invoke(CH.MAIL_GET_EMAIL_BODY_PARTS, accountId, messageId),
    getEmailRaw: (accountId, messageId) => ipcRenderer.invoke(CH.MAIL_GET_EMAIL_RAW, accountId, messageId),
    bulkDeleteByFrom: (accountId, fromAddresses) =>
        ipcRenderer.invoke(CH.MAIL_BULK_DELETE_BY_FROM, accountId, fromAddresses),
    deleteByMessageIds: (accountId, messageIds) =>
        ipcRenderer.invoke(CH.MAIL_DELETE_BY_MESSAGE_IDS, accountId, messageIds),
    bulkDeleteBySubject: (accountId, subjects) =>
        ipcRenderer.invoke(CH.MAIL_BULK_DELETE_BY_SUBJECT, accountId, subjects),
    bulkDeleteByRule: (accountId, ruleLines) =>
        ipcRenderer.invoke(CH.MAIL_BULK_DELETE_BY_RULE, accountId, ruleLines),
    buildRuleGroups: (accountId, mode) => ipcRenderer.invoke(CH.MAIL_BUILD_RULE_GROUPS, accountId, mode),
    getCachedResult: (accountId, mode) => ipcRenderer.invoke(CH.MAIL_GET_CACHED_RESULT, accountId, mode),

    // Ollama
    testOllamaConnection: host => ipcRenderer.invoke(CH.OLLAMA_TEST_CONNECTION, host),
    getOllamaModels: host => ipcRenderer.invoke(CH.OLLAMA_GET_MODELS, host),
    runAIJudgment: (accountId, messageIds, mode) =>
        ipcRenderer.invoke(CH.OLLAMA_RUN_JUDGMENT, accountId, messageIds, mode),
    cancelAIJudgment: () => ipcRenderer.invoke(CH.OLLAMA_CANCEL_JUDGMENT),

    // Data
    clearAICache: () => ipcRenderer.invoke(CH.DATA_CLEAR_AI_CACHE),
    clearAllCache: () => ipcRenderer.invoke(CH.DATA_CLEAR_ALL_CACHE),
    exportSettings: () => ipcRenderer.invoke(CH.DATA_EXPORT_SETTINGS),
    importSettings: json => ipcRenderer.invoke(CH.DATA_IMPORT_SETTINGS, json),
    exportAccountData: () => ipcRenderer.invoke(CH.DATA_EXPORT_ACCOUNT_DATA),
    importAccountData: json => ipcRenderer.invoke(CH.DATA_IMPORT_ACCOUNT_DATA, json),

    // Detail
    openDetailWindow: data => ipcRenderer.invoke(CH.DETAIL_OPEN, data),
    getDetailData: () => ipcRenderer.invoke(CH.DETAIL_GET_DATA),

    // Trash
    openTrashWindow: accountId => ipcRenderer.invoke(CH.TRASH_OPEN, accountId),
    getTrashData: () => ipcRenderer.invoke(CH.TRASH_GET_DATA),
    fetchTrash: accountId => ipcRenderer.invoke(CH.TRASH_FETCH, accountId),
    emptyTrash: accountId => ipcRenderer.invoke(CH.TRASH_EMPTY, accountId),
    deleteTrashMessages: (accountId, messageIds) =>
        ipcRenderer.invoke(CH.TRASH_DELETE_SELECTED, accountId, messageIds),

    // State
    getAppState: () => ipcRenderer.invoke(CH.STATE_GET),
    saveAppState: state => ipcRenderer.invoke(CH.STATE_SAVE, state),

    // Event listeners (return unsubscribe function)
    onFetchProgress: callback => {
        const handler = (_event: unknown, progress: any) => callback(progress);
        ipcRenderer.on(CH.EVENT_FETCH_PROGRESS, handler);
        return () => ipcRenderer.removeListener(CH.EVENT_FETCH_PROGRESS, handler);
    },
    onAIProgress: callback => {
        const handler = (_event: unknown, progress: any) => callback(progress);
        ipcRenderer.on(CH.EVENT_AI_PROGRESS, handler);
        return () => ipcRenderer.removeListener(CH.EVENT_AI_PROGRESS, handler);
    },
    onDetailData: callback => {
        const handler = (_event: unknown, data: any) => callback(data);
        ipcRenderer.on(CH.EVENT_DETAIL_DATA, handler);
        return () => ipcRenderer.removeListener(CH.EVENT_DETAIL_DATA, handler);
    },
};

contextBridge.exposeInMainWorld('mailvalet', api);

// Console bridge: forward main process logs to DevTools
ipcRenderer.on(
    CH.MAIN_CONSOLE,
    (
        _event,
        data: {
            level: string;
            args: Array<{ type: string; value?: string; message?: string; stack?: string; name?: string }>;
        }
    ) => {
        const { level, args } = data;
        const deserializedArgs = args.map(arg => {
            if (arg.type === 'error') {
                const error = new Error(arg.message || 'Unknown error');
                if (arg.stack) error.stack = arg.stack;
                if (arg.name) error.name = arg.name;
                return error;
            } else if (arg.type === 'object') {
                try {
                    return JSON.parse(arg.value || '{}');
                } catch {
                    return arg.value;
                }
            } else {
                return arg.value;
            }
        });
        switch (level) {
            case 'log':
                console.log('[Main]', ...deserializedArgs);
                break;
            case 'error':
                console.error('[Main]', ...deserializedArgs);
                break;
            case 'warn':
                console.warn('[Main]', ...deserializedArgs);
                break;
            case 'info':
                console.info('[Main]', ...deserializedArgs);
                break;
            case 'debug':
                console.debug('[Main]', ...deserializedArgs);
                break;
            default:
                console.log('[Main]', ...deserializedArgs);
        }
    }
);
