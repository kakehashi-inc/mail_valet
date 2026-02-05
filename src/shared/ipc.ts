import type {
    AppInfo,
    AppLanguage,
    AppTheme,
    GeneralSettings,
    FetchSettings,
    DeleteSettings,
    OllamaSettings,
    AIJudgmentSettings,
    GcpSettings,
    Account,
    GmailLabel,
    AccountLabelSelection,
    SamplingResult,
    SamplingMeta,
    FetchMode,
    DeleteResult,
    FetchEmailsOptions,
    DetailWindowData,
    AppState,
    FetchProgress,
    AIProgress,
} from './types';

export type IpcApi = {
    // App info
    getAppInfo(): Promise<AppInfo>;
    setTheme(theme: AppTheme): Promise<{ theme: AppTheme }>;
    setLanguage(language: AppLanguage): Promise<{ language: AppLanguage }>;

    // Window controls
    minimize(): Promise<void>;
    maximizeOrRestore(): Promise<boolean>;
    isMaximized(): Promise<boolean>;
    close(): Promise<void>;

    // Settings
    getGeneralSettings(): Promise<GeneralSettings>;
    saveGeneralSettings(settings: GeneralSettings): Promise<void>;
    getFetchSettings(): Promise<FetchSettings>;
    saveFetchSettings(settings: FetchSettings): Promise<void>;
    getDeleteSettings(): Promise<DeleteSettings>;
    saveDeleteSettings(settings: DeleteSettings): Promise<void>;
    getOllamaSettings(): Promise<OllamaSettings>;
    saveOllamaSettings(settings: OllamaSettings): Promise<void>;
    getAIJudgmentSettings(): Promise<AIJudgmentSettings>;
    saveAIJudgmentSettings(settings: AIJudgmentSettings): Promise<void>;
    getGcpSettings(): Promise<GcpSettings>;
    saveGcpSettings(settings: GcpSettings): Promise<void>;
    importGcpJson(): Promise<GcpSettings | null>;

    // Accounts
    getAccounts(): Promise<Account[]>;
    addAccount(): Promise<Account | null>;
    removeAccount(accountId: string): Promise<void>;
    getLabels(accountId: string): Promise<GmailLabel[]>;
    getSelectedLabels(accountId: string): Promise<AccountLabelSelection>;
    saveSelectedLabels(accountId: string, selection: AccountLabelSelection): Promise<void>;
    refreshLabels(accountId: string): Promise<GmailLabel[]>;
    getConnectionStatus(accountId: string): Promise<boolean>;

    // Gmail
    fetchEmails(options: FetchEmailsOptions): Promise<SamplingResult>;
    getEmailBody(accountId: string, messageId: string): Promise<string>;
    getEmailRaw(accountId: string, messageId: string): Promise<string>;
    bulkDeleteByFrom(accountId: string, fromAddresses: string[]): Promise<DeleteResult>;
    getCachedResult(accountId: string, mode?: FetchMode): Promise<{ result: SamplingResult; meta: SamplingMeta } | null>;

    // Ollama
    testOllamaConnection(host: string): Promise<boolean>;
    getOllamaModels(host: string): Promise<string[]>;
    runAIJudgment(accountId: string, messageIds: string[], mode?: FetchMode): Promise<void>;
    cancelAIJudgment(): Promise<void>;

    // Data management
    clearAICache(): Promise<void>;
    clearAllCache(): Promise<void>;
    exportSettings(): Promise<string>;
    importSettings(json: string): Promise<void>;
    resetAllData(): Promise<void>;

    // Detail window
    openDetailWindow(data: DetailWindowData): Promise<void>;
    getDetailData(): Promise<DetailWindowData | null>;

    // App state
    getAppState(): Promise<AppState>;
    saveAppState(state: Partial<AppState>): Promise<void>;

    // Event listeners
    onFetchProgress(callback: (progress: FetchProgress) => void): () => void;
    onAIProgress(callback: (progress: AIProgress) => void): () => void;
    onDetailData(callback: (data: DetailWindowData) => void): () => void;
};

declare global {
    interface Window {
        mailvalet: IpcApi;
    }
}
