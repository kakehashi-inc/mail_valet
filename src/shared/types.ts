// プラットフォーム識別子
export type PlatformId = 'win32' | 'darwin' | 'linux';

// アプリのテーマ設定
export type AppTheme = 'light' | 'dark' | 'system';

// アプリの言語設定
export type AppLanguage = 'ja' | 'en';

// アプリ情報
export type AppInfo = {
    name: string;
    version: string;
    language: AppLanguage;
    theme: AppTheme;
    os: PlatformId;
};

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export type GeneralSettings = {
    language: AppLanguage;
    theme: AppTheme;
};

export type ReadFilter = 'all' | 'unread' | 'read';

export interface FetchSettings {
    samplingDays: number;
    maxFetchCount: number;
    readFilter: ReadFilter;
}

export interface DeleteSettings {
    excludeImportant: boolean;
    excludeStarred: boolean;
}

export interface OllamaSettings {
    host: string;
    model: string;
    timeout: number;
    concurrency: number;
}

export interface AIJudgmentSettings {
    allowedLanguages: string[];
}

export interface GcpSettings {
    clientId: string;
    clientSecret: string;
    projectId: string;
}

// ---------------------------------------------------------------------------
// Mail Provider (extensible for future providers: outlook, yahoo, etc.)
// ---------------------------------------------------------------------------
export type MailProviderId = 'gmail';

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------
export interface Account {
    id: string;
    email: string;
    displayName: string;
    provider: MailProviderId;
}

export interface AccountTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
}

export interface GmailLabel {
    id: string;
    name: string;
    type: 'system' | 'user';
}

export interface LabelTreeNode {
    id: string;
    name: string;
    fullPath: string;
    children: LabelTreeNode[];
    labelId?: string;
}

export interface AccountLabelSelection {
    selectedLabelIds: string[];
}

// ---------------------------------------------------------------------------
// Fetch Mode
// ---------------------------------------------------------------------------
export type FetchMode = 'days' | 'range';

// ---------------------------------------------------------------------------
// Email Body Parts (for AI judgment content hashing)
// ---------------------------------------------------------------------------
export interface EmailBodyParts {
    plain: string;
    html: string;
}

// ---------------------------------------------------------------------------
// Email / Sampling
// ---------------------------------------------------------------------------
export interface EmailMessage {
    id: string;
    threadId: string;
    from: string;
    fromAddress: string;
    to: string;
    subject: string;
    date: string;
    snippet: string;
    labelIds: string[];
    isImportant: boolean;
    isStarred: boolean;
    body?: string;
    rawData?: string;
    aiJudgment?: AIJudgment;
}

export interface FromGroup {
    fromAddress: string;
    fromNames: string[];
    count: number;
    frequency: number;
    latestSubject: string;
    latestDate: string;
    messages: EmailMessage[];
    aiScoreRange: {
        marketing: [number, number];
        spam: [number, number];
    };
}

export interface SamplingResult {
    messages: EmailMessage[];
    fromGroups: FromGroup[];
    periodStart: string;
    periodEnd: string;
    totalCount: number;
}

export interface SamplingMeta {
    mode: FetchMode;
    startDate: string;
    endDate: string;
    fetchedAt: string;
    labelIds: string[];
    totalCount: number;
}

// ---------------------------------------------------------------------------
// AI Judgment
// ---------------------------------------------------------------------------
export interface AIJudgment {
    marketing: number;
    spam: number;
    judgedAt: string;
}

export interface AIJudgmentCacheEntry {
    contentHash: string;
    marketing: number;
    spam: number;
    judgedAt: string;
}

// ---------------------------------------------------------------------------
// App State
// ---------------------------------------------------------------------------
export interface WindowBounds {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximized: boolean;
}

export interface AppState {
    lastAccountId: string | null;
    windowBounds: WindowBounds | null;
}

// ---------------------------------------------------------------------------
// IPC Event Payloads
// ---------------------------------------------------------------------------
export interface FetchProgress {
    current: number;
    total: number;
    message: string;
}

export interface AIProgress {
    current: number;
    total: number;
    message: string;
}

export interface DeleteResult {
    trashed: number;
    excluded: number;
    errors: number;
}

export interface FetchEmailsOptions {
    accountId: string;
    startDate?: string;
    endDate?: string;
    useDays?: boolean;
}

// ---------------------------------------------------------------------------
// Detail Window
// ---------------------------------------------------------------------------
export interface DetailWindowData {
    fromAddress: string;
    fromNames: string[];
    messages: EmailMessage[];
    aiScoreRange: {
        marketing: [number, number];
        spam: [number, number];
    };
    accountId: string;
}
