import crypto from 'crypto';
import type {
    Account,
    AccountTokens,
    AccountLabelSelection,
    ImapConnectionSettings,
    AccountRules,
    AccountExportData,
    FullExportData,
    GcpSettings,
} from '../../shared/types';
import {
    getAccountsDir,
    getAccountDir,
    getAccountCacheDir,
    getAccountProfilePath,
    getAccountTokensPath,
    getAccountLabelsPath,
    getAccountImapSettingsPath,
    getAccountRulesPath,
} from '../../shared/constants';
import { readJsonFile, writeJsonFile, ensureDir, listDirectories, deleteDir } from './file-manager';
import { encrypt, decrypt, exportEncryptionKey, importEncryptionKey } from './encryption';
import { getGcpSettings, saveGcpSettings } from './settings-manager';

function generateAccountId(): string {
    return crypto.randomBytes(8).toString('hex');
}

export async function getAllAccounts(): Promise<Account[]> {
    const accountIds = await listDirectories(getAccountsDir());
    const accounts: Account[] = [];
    for (const id of accountIds) {
        const profile = await readJsonFile<Account | null>(getAccountProfilePath(id), null);
        if (profile) {
            accounts.push({ ...profile, id });
        }
    }
    return accounts;
}

export async function createAccount(email: string, displayName: string, tokens: AccountTokens): Promise<Account> {
    const id = generateAccountId();
    const accountDir = getAccountDir(id);
    const cacheDir = getAccountCacheDir(id);
    await ensureDir(accountDir);
    await ensureDir(cacheDir);

    const profile: Account = { id, email, displayName, provider: 'gmail' };
    await writeJsonFile(getAccountProfilePath(id), profile);
    await saveAccountTokens(id, tokens);
    await writeJsonFile(getAccountLabelsPath(id), { selectedLabelIds: ['INBOX'] });
    return profile;
}

export async function removeAccount(accountId: string): Promise<void> {
    await deleteDir(getAccountDir(accountId));
}

export async function getAccountTokens(accountId: string): Promise<AccountTokens | null> {
    const raw = await readJsonFile<any>(getAccountTokensPath(accountId), null);
    if (!raw) return null;
    try {
        return {
            accessToken: raw.accessToken ? decrypt(raw.accessToken) : '',
            refreshToken: raw.refreshToken ? decrypt(raw.refreshToken) : '',
            expiresAt: raw.expiresAt || 0,
        };
    } catch (e) {
        console.error('[AccountManager] Failed to decrypt tokens:', e);
        return null;
    }
}

export async function saveAccountTokens(accountId: string, tokens: AccountTokens): Promise<void> {
    const encrypted = {
        accessToken: tokens.accessToken ? encrypt(tokens.accessToken) : '',
        refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : '',
        expiresAt: tokens.expiresAt,
    };
    await writeJsonFile(getAccountTokensPath(accountId), encrypted);
}

export async function getSelectedLabels(accountId: string): Promise<AccountLabelSelection> {
    return readJsonFile<AccountLabelSelection>(getAccountLabelsPath(accountId), { selectedLabelIds: ['INBOX'] });
}

export async function saveSelectedLabels(accountId: string, selection: AccountLabelSelection): Promise<void> {
    await writeJsonFile(getAccountLabelsPath(accountId), selection);
}

export async function createImapAccount(
    email: string,
    displayName: string,
    imapSettings: ImapConnectionSettings
): Promise<Account> {
    const id = generateAccountId();
    const accountDir = getAccountDir(id);
    const cacheDir = getAccountCacheDir(id);
    await ensureDir(accountDir);
    await ensureDir(cacheDir);

    const profile: Account = { id, email, displayName, provider: 'imap' };
    await writeJsonFile(getAccountProfilePath(id), profile);
    await saveImapSettings(id, imapSettings);
    await writeJsonFile(getAccountLabelsPath(id), { selectedLabelIds: ['INBOX'] });
    return profile;
}

export async function getImapSettings(accountId: string): Promise<ImapConnectionSettings | null> {
    const raw = await readJsonFile<any>(getAccountImapSettingsPath(accountId), null);
    if (!raw) return null;
    try {
        return {
            host: raw.host || '',
            port: raw.port || 993,
            username: raw.username || '',
            password: raw.password ? decrypt(raw.password) : '',
            security: raw.security || 'ssl',
        };
    } catch (e) {
        console.error('[AccountManager] Failed to decrypt IMAP settings:', e);
        return null;
    }
}

export async function saveImapSettings(accountId: string, settings: ImapConnectionSettings): Promise<void> {
    const encrypted = {
        host: settings.host,
        port: settings.port,
        username: settings.username,
        password: settings.password ? encrypt(settings.password) : '',
        security: settings.security,
    };
    await writeJsonFile(getAccountImapSettingsPath(accountId), encrypted);
}

export async function updateAccountProfile(
    accountId: string,
    updates: Partial<Omit<Account, 'id' | 'provider'>>
): Promise<void> {
    const profile = await readJsonFile<Account | null>(getAccountProfilePath(accountId), null);
    if (!profile) return;
    const updated = { ...profile, ...updates };
    await writeJsonFile(getAccountProfilePath(accountId), updated);
}

const DEFAULT_ACCOUNT_RULES: AccountRules = {
    ruleText: '',
    lines: [],
};

export async function getAccountRules(accountId: string): Promise<AccountRules> {
    return readJsonFile<AccountRules>(getAccountRulesPath(accountId), DEFAULT_ACCOUNT_RULES);
}

export async function saveAccountRules(accountId: string, rules: AccountRules): Promise<void> {
    await writeJsonFile(getAccountRulesPath(accountId), rules);
}

// ---------------------------------------------------------------------------
// Export / Import Account Data
// ---------------------------------------------------------------------------
const EXPORT_VERSION = 1;

export async function exportAccountData(): Promise<string> {
    const accounts = await getAllAccounts();
    const gcpSettings = await getGcpSettings();
    const accountsData: AccountExportData[] = [];

    for (const account of accounts) {
        const labels = await getSelectedLabels(account.id);
        const rules = await getAccountRules(account.id);

        const exportData: AccountExportData = {
            id: account.id,
            email: account.email,
            displayName: account.displayName,
            provider: account.provider,
            labels,
            rules,
        };

        // Include IMAP settings for IMAP accounts (plaintext for cross-machine portability)
        if (account.provider === 'imap') {
            const imapSettings = await getImapSettings(account.id);
            if (imapSettings) {
                exportData.imap = imapSettings; // Plaintext - will be re-encrypted on import
            }
        }

        // Include OAuth tokens for Gmail accounts (plaintext for cross-machine portability)
        if (account.provider === 'gmail') {
            const tokens = await getAccountTokens(account.id);
            if (tokens) {
                exportData.tokens = tokens; // Plaintext - will be re-encrypted on import
            }
        }

        accountsData.push(exportData);
    }

    // GCP settings (plaintext for cross-machine portability)
    const gcpExport: GcpSettings | undefined =
        gcpSettings.clientId || gcpSettings.clientSecret
            ? {
                  clientId: gcpSettings.clientId,
                  clientSecret: gcpSettings.clientSecret, // Plaintext
                  projectId: gcpSettings.projectId,
              }
            : undefined;

    const exportData: FullExportData = {
        version: EXPORT_VERSION,
        exportedAt: new Date().toISOString(),
        encryptionKey: exportEncryptionKey(),
        gcp: gcpExport,
        accounts: accountsData,
    };

    return JSON.stringify(exportData, null, 2);
}

export async function importAccountData(json: string): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    try {
        const data = JSON.parse(json) as FullExportData;

        if (!data.version || !Array.isArray(data.accounts)) {
            throw new Error('Invalid export data format');
        }

        // Import encryption key first (overwrite existing key)
        if (data.encryptionKey) {
            try {
                importEncryptionKey(data.encryptionKey);
                console.info('[AccountManager] Imported encryption key from export');
            } catch (e) {
                errors.push(`Encryption key: ${e instanceof Error ? e.message : 'unknown error'}`);
            }
        }

        // Import GCP settings if present (plaintext in export, will be encrypted by saveGcpSettings)
        if (data.gcp && (data.gcp.clientId || data.gcp.clientSecret)) {
            try {
                await saveGcpSettings({
                    clientId: data.gcp.clientId,
                    clientSecret: data.gcp.clientSecret || '',
                    projectId: data.gcp.projectId,
                });
            } catch (e) {
                errors.push(`GCP settings: ${e instanceof Error ? e.message : 'unknown error'}`);
            }
        }

        // Build email-to-id map for existing accounts
        const existingAccounts = await getAllAccounts();
        const existingEmailMap = new Map(existingAccounts.map(a => [a.email.toLowerCase(), a.id]));

        for (const accountData of data.accounts) {
            try {
                // Use existing account ID if same email exists, otherwise create new
                const existingId = existingEmailMap.get(accountData.email.toLowerCase());
                const id = existingId || generateAccountId();
                const accountDir = getAccountDir(id);
                const cacheDir = getAccountCacheDir(id);
                await ensureDir(accountDir);
                await ensureDir(cacheDir);

                // Save profile
                const profile: Account = {
                    id,
                    email: accountData.email,
                    displayName: accountData.displayName,
                    provider: accountData.provider,
                };
                await writeJsonFile(getAccountProfilePath(id), profile);

                // Save labels
                if (accountData.labels) {
                    await saveSelectedLabels(id, accountData.labels);
                } else if (!existingId) {
                    await writeJsonFile(getAccountLabelsPath(id), { selectedLabelIds: ['INBOX'] });
                }

                // Save rules
                if (accountData.rules) {
                    await saveAccountRules(id, accountData.rules);
                }

                // Save IMAP settings if present (plaintext in export, saveImapSettings encrypts)
                if (accountData.provider === 'imap' && accountData.imap) {
                    await saveImapSettings(id, accountData.imap);
                }

                // Save OAuth tokens if present (plaintext in export, saveAccountTokens encrypts)
                if (accountData.provider === 'gmail' && accountData.tokens) {
                    await saveAccountTokens(id, accountData.tokens);
                }

                imported++;
            } catch (e) {
                errors.push(`${accountData.email}: ${e instanceof Error ? e.message : 'unknown error'}`);
            }
        }
    } catch (e) {
        errors.push(`Parse error: ${e instanceof Error ? e.message : 'unknown error'}`);
    }

    return { imported, errors };
}
