import os from 'os';
import path from 'path';

export const APP_DIR_NAME = '.mailvalet';

export function getHomeDir(): string {
    return os.homedir();
}

export function getAppRootDir(): string {
    return path.join(getHomeDir(), APP_DIR_NAME);
}

// Sub-directory paths
export function getSettingsDir(): string {
    return path.join(getAppRootDir(), 'settings');
}

export function getAccountsDir(): string {
    return path.join(getAppRootDir(), 'accounts');
}

export function getAccountDir(accountId: string): string {
    return path.join(getAccountsDir(), accountId);
}

export function getAccountCacheDir(accountId: string): string {
    return path.join(getAccountDir(accountId), 'cache');
}

export function getCacheDir(): string {
    return path.join(getAppRootDir(), 'cache');
}

export function getStateDir(): string {
    return path.join(getAppRootDir(), 'state');
}

export function getLogsDir(): string {
    return path.join(getAppRootDir(), 'logs');
}

// Settings file paths
export function getGeneralSettingsPath(): string {
    return path.join(getSettingsDir(), 'general.json');
}

export function getFetchSettingsPath(): string {
    return path.join(getSettingsDir(), 'fetch.json');
}

export function getDeleteSettingsPath(): string {
    return path.join(getSettingsDir(), 'delete.json');
}

export function getOllamaSettingsPath(): string {
    return path.join(getSettingsDir(), 'ollama.json');
}

export function getAIJudgmentSettingsPath(): string {
    return path.join(getSettingsDir(), 'ai-judgment.json');
}

export function getGcpSettingsPath(): string {
    return path.join(getSettingsDir(), 'gcp.json');
}

// Account file paths
export function getAccountProfilePath(accountId: string): string {
    return path.join(getAccountDir(accountId), 'profile.json');
}

export function getAccountTokensPath(accountId: string): string {
    return path.join(getAccountDir(accountId), 'tokens.json');
}

export function getAccountLabelsPath(accountId: string): string {
    return path.join(getAccountDir(accountId), 'labels.json');
}

export function getAccountImapSettingsPath(accountId: string): string {
    return path.join(getAccountDir(accountId), 'imap.json');
}

export function getAccountRulesPath(accountId: string): string {
    return path.join(getAccountDir(accountId), 'rules.json');
}

export function getSamplingResultPath(accountId: string, mode: string = 'days'): string {
    return path.join(getAccountCacheDir(accountId), `sampling_${mode}.json`);
}

export function getSamplingMetaPath(accountId: string, mode: string = 'days'): string {
    return path.join(getAccountCacheDir(accountId), `sampling_${mode}_meta.json`);
}

// Global cache
export function getAIJudgmentCachePath(): string {
    return path.join(getCacheDir(), 'ai_judgments.json');
}

// State
export function getAppStatePath(): string {
    return path.join(getStateDir(), 'app.json');
}

// Gmail API
export const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
export const GOOGLE_OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
export const GMAIL_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
];
export const OAUTH_REDIRECT_URI = 'http://127.0.0.1';

// Defaults
export const DEFAULT_GENERAL_SETTINGS = {
    language: 'en' as const,
    theme: 'system' as const,
};

export const DEFAULT_FETCH_SETTINGS = {
    samplingDays: 30,
    maxFetchCount: 1000,
    readFilter: 'all' as const,
};

export const DEFAULT_DELETE_SETTINGS = {
    excludeImportant: true,
    excludeStarred: true,
};

export const DEFAULT_OLLAMA_SETTINGS = {
    host: 'http://localhost:11434',
    model: '',
    timeout: 180,
    concurrency: 1,
};

export const DEFAULT_AI_JUDGMENT_SETTINGS = {
    allowedLanguages: [] as string[],
};

export const DEFAULT_GCP_SETTINGS = {
    clientId: '',
    clientSecret: '',
    projectId: '',
};

export const DEFAULT_IMAP_SETTINGS = {
    host: '',
    port: 993,
    username: '',
    password: '',
    security: 'ssl' as const,
};

// IPC Channels
export const IPC_CHANNELS = {
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
