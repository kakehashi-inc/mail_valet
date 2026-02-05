import crypto from 'crypto';
import type { Account, AccountTokens, AccountLabelSelection } from '../../shared/types';
import {
    getAccountsDir,
    getAccountDir,
    getAccountCacheDir,
    getAccountProfilePath,
    getAccountTokensPath,
    getAccountLabelsPath,
} from '../../shared/constants';
import { readJsonFile, writeJsonFile, ensureDir, listDirectories, deleteDir } from './file-manager';
import { encrypt, decrypt } from './encryption';

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
    } catch {
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
