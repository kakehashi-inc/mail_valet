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
    MailLabel,
    AccountLabelSelection,
    SamplingResult,
    SamplingMeta,
    FetchMode,
    DeleteResult,
    FetchEmailsOptions,
    DetailWindowData,
    EmailBodyParts,
    AppState,
    FetchProgress,
    AIProgress,
    ImapConnectionSettings,
} from './types';

export type IpcApi = {
    // App info
    getAppInfo(): Promise<AppInfo>;
    setTheme(theme: AppTheme): Promise<'light' | 'dark'>;
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
    getLabels(accountId: string): Promise<MailLabel[]>;
    getSelectedLabels(accountId: string): Promise<AccountLabelSelection>;
    saveSelectedLabels(accountId: string, selection: AccountLabelSelection): Promise<void>;
    refreshLabels(accountId: string): Promise<MailLabel[]>;
    getConnectionStatus(accountId: string): Promise<boolean>;
    addImapAccount(settings: ImapConnectionSettings): Promise<Account | null>;
    testImapConnection(settings: ImapConnectionSettings): Promise<boolean>;
    getImapSettings(accountId: string): Promise<ImapConnectionSettings | null>;
    updateImapSettings(accountId: string, settings: ImapConnectionSettings): Promise<boolean>;

    // Mail
    fetchEmails(options: FetchEmailsOptions): Promise<SamplingResult>;
    cancelFetch(): Promise<void>;
    getEmailBody(accountId: string, messageId: string): Promise<string>;
    getEmailBodyParts(accountId: string, messageId: string): Promise<EmailBodyParts>;
    getEmailRaw(accountId: string, messageId: string): Promise<string>;
    bulkDeleteByFrom(accountId: string, fromAddresses: string[]): Promise<DeleteResult>;
    deleteByMessageIds(accountId: string, messageIds: string[]): Promise<DeleteResult>;
    bulkDeleteBySubject(accountId: string, subjects: string[]): Promise<DeleteResult>;
    getCachedResult(
        accountId: string,
        mode?: FetchMode
    ): Promise<{ result: SamplingResult; meta: SamplingMeta } | null>;

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
