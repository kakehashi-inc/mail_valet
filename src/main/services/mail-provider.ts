import type {
    AccountTokens,
    GmailLabel,
    SamplingResult,
    FetchEmailsOptions,
    FetchProgress,
    DeleteResult,
} from '../../shared/types';

/**
 * Abstract mail provider interface.
 * Currently only Gmail is implemented, but this interface allows adding
 * new providers (Outlook, Yahoo Mail, etc.) in the future.
 */
export interface MailProvider {
    readonly providerId: string;
    readonly displayName: string;

    startOAuthFlow(
        clientId: string,
        clientSecret: string
    ): Promise<{ tokens: AccountTokens; email: string; displayName: string } | null>;

    checkConnection(accountId: string, clientId: string, clientSecret: string): Promise<boolean>;

    fetchLabels(accountId: string, clientId: string, clientSecret: string): Promise<GmailLabel[]>;

    fetchEmails(
        options: FetchEmailsOptions,
        clientId: string,
        clientSecret: string,
        selectedLabelIds: string[],
        onProgress?: (progress: FetchProgress) => void
    ): Promise<SamplingResult>;

    getEmailBody(accountId: string, messageId: string, clientId: string, clientSecret: string): Promise<string>;

    getEmailRaw(accountId: string, messageId: string, clientId: string, clientSecret: string): Promise<string>;

    trashEmails(accountId: string, messageIds: string[], clientId: string, clientSecret: string): Promise<DeleteResult>;
}

/**
 * Registry for mail providers.
 * Call registerProvider() during app startup to register available providers.
 */
const providers = new Map<string, MailProvider>();

export function registerProvider(provider: MailProvider): void {
    providers.set(provider.providerId, provider);
}

export function getProvider(providerId: string): MailProvider {
    const provider = providers.get(providerId);
    if (!provider) {
        throw new Error(`Unknown mail provider: ${providerId}`);
    }
    return provider;
}

export function getAvailableProviders(): MailProvider[] {
    return Array.from(providers.values());
}
