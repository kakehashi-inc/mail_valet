import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getEncryptionKeyPath, getSettingsDir, getAccountsDir } from '../../shared/constants';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;

// ---------------------------------------------------------------------------
// Core Encryption Functions
// ---------------------------------------------------------------------------

function ensureSettingsDir(): void {
    const dir = getSettingsDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function encryptWithKey(key: Buffer, text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

function decryptWithKey(key: Buffer, encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted format');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function tryDecryptWithKey(key: Buffer, encryptedText: string): string | null {
    try {
        return decryptWithKey(key, encryptedText);
    } catch {
        return null;
    }
}

function generateRandomKey(): Buffer {
    return crypto.randomBytes(KEY_LENGTH);
}

function saveKey(key: Buffer): void {
    ensureSettingsDir();
    fs.writeFileSync(getEncryptionKeyPath(), key, { mode: 0o600 });
}

function loadKey(): Buffer | null {
    const keyPath = getEncryptionKeyPath();
    if (!fs.existsSync(keyPath)) return null;
    const key = fs.readFileSync(keyPath);
    if (key.length !== KEY_LENGTH) {
        throw new Error('Invalid encryption key file');
    }
    return key;
}

// ---------------------------------------------------------------------------
// Main Key Management
// ---------------------------------------------------------------------------

function getOrCreateKey(): Buffer {
    if (cachedKey) {
        return cachedKey;
    }

    // If not initialized, run initialization (this handles all cases)
    initializeEncryption();

    // After initialization, cachedKey should be set
    if (!cachedKey) {
        throw new Error('Encryption initialization failed');
    }

    return cachedKey;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize encryption system.
 * MUST be called at app startup before any encrypt/decrypt operations.
 *
 * Flow:
 * 1. If key file exists: load and use it
 * 2. If no key file:
 *    a. Check for legacy encrypted files (migration targets)
 *    b. Create new random key and save it FIRST
 *    c. If legacy data exists: migrate (decrypt with legacy key, re-encrypt with new key)
 */
export function initializeEncryption(): void {
    if (cachedKey) return; // Already initialized

    // Step 1: Check for existing key file
    const existingKey = loadKey();
    if (existingKey) {
        cachedKey = existingKey;
        console.log('[Encryption] Initialized with existing key');
        return;
    }

    // Step 2: No key file - check for migration targets BEFORE creating key
    const legacyFiles = findLegacyEncryptedFiles();
    const hasLegacyData = legacyFiles.length > 0 && checkLegacyDataExists(legacyFiles);

    // Step 3: Create new key file FIRST (always)
    const newKey = generateRandomKey();
    saveKey(newKey);
    cachedKey = newKey;
    console.log('[Encryption] Created new key file');

    // Step 4: If legacy data exists, migrate it now
    if (hasLegacyData) {
        console.log('[Encryption] Legacy data detected, starting migration...');
        const legacyKey = deriveLegacyKey();
        for (const file of legacyFiles) {
            migrateFileToNewKey(file, legacyKey, newKey);
        }
        console.log('[Encryption] Legacy migration complete');
    }
}

/**
 * Check if any legacy file contains encrypted data that legacy key can decrypt.
 */
function checkLegacyDataExists(files: LegacyEncryptedFile[]): boolean {
    const legacyKey = deriveLegacyKey();
    for (const file of files) {
        const encryptedValue = findEncryptedValueFromFile(file);
        if (encryptedValue && encryptedValue.includes(':')) {
            if (tryDecryptWithKey(legacyKey, encryptedValue) !== null) {
                return true;
            }
        }
    }
    return false;
}

export function encrypt(text: string): string {
    const key = getOrCreateKey();
    return encryptWithKey(key, text);
}

export function decrypt(encryptedText: string): string {
    const key = getOrCreateKey();
    return decryptWithKey(key, encryptedText);
}

export function exportEncryptionKey(): string {
    const key = getOrCreateKey();
    return key.toString('base64');
}

export function importEncryptionKey(base64Key: string): boolean {
    const keyPath = getEncryptionKeyPath();
    if (fs.existsSync(keyPath)) {
        return false; // Key already exists
    }

    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== KEY_LENGTH) {
        throw new Error('Invalid encryption key format');
    }

    saveKey(key);
    cachedKey = key;
    return true;
}

// ===========================================================================
// LEGACY MIGRATION SUPPORT
// ===========================================================================
// This section handles one-time migration from the deprecated hostname+username
// key derivation method. This is an exceptional rescue operation for users
// upgrading from older versions.
//
// The migration is handled in initializeEncryption() at app startup:
// 1. Check for legacy encrypted files
// 2. Create new random key file FIRST
// 3. Migrate legacy data (decrypt with old key, re-encrypt with new key)
//
// DO NOT use these functions for any other purpose.
// This code should be removed in a future version once all users have migrated.
// ===========================================================================

const LEGACY_SALT = 'mailvalet-encryption-salt-v1';

function deriveLegacyKey(): Buffer {
    const machineId = `${os.hostname()}-${os.userInfo().username}-${LEGACY_SALT}`;
    return crypto.pbkdf2Sync(machineId, LEGACY_SALT, 100000, KEY_LENGTH, 'sha256');
}

interface LegacyEncryptedFile {
    path: string;
    type: 'tokens' | 'imap' | 'gcp';
}

function findLegacyEncryptedFiles(): LegacyEncryptedFile[] {
    const files: LegacyEncryptedFile[] = [];
    const accountsDir = getAccountsDir();

    if (fs.existsSync(accountsDir)) {
        try {
            const entries = fs.readdirSync(accountsDir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const accountPath = path.join(accountsDir, entry.name);

                const tokensPath = path.join(accountPath, 'tokens.json');
                if (fs.existsSync(tokensPath)) {
                    files.push({ path: tokensPath, type: 'tokens' });
                }

                const imapPath = path.join(accountPath, 'imap.json');
                if (fs.existsSync(imapPath)) {
                    files.push({ path: imapPath, type: 'imap' });
                }
            }
        } catch {
            // Ignore errors
        }
    }

    const gcpPath = path.join(getSettingsDir(), 'gcp.json');
    if (fs.existsSync(gcpPath)) {
        files.push({ path: gcpPath, type: 'gcp' });
    }

    return files;
}

function findEncryptedValueFromFile(file: LegacyEncryptedFile): string | null {
    try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const data = JSON.parse(content);

        if (file.type === 'tokens') {
            return data.accessToken || data.refreshToken || null;
        } else if (file.type === 'imap') {
            return data.password || null;
        } else if (file.type === 'gcp') {
            return data.clientSecret || null;
        }
    } catch {
        // Ignore errors
    }
    return null;
}

function migrateFileToNewKey(file: LegacyEncryptedFile, legacyKey: Buffer, newKey: Buffer): void {
    try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const data = JSON.parse(content);
        let modified = false;

        if (file.type === 'tokens') {
            if (data.accessToken && data.accessToken.includes(':')) {
                const decrypted = tryDecryptWithKey(legacyKey, data.accessToken);
                if (decrypted !== null) {
                    data.accessToken = encryptWithKey(newKey, decrypted);
                    modified = true;
                }
            }
            if (data.refreshToken && data.refreshToken.includes(':')) {
                const decrypted = tryDecryptWithKey(legacyKey, data.refreshToken);
                if (decrypted !== null) {
                    data.refreshToken = encryptWithKey(newKey, decrypted);
                    modified = true;
                }
            }
        } else if (file.type === 'imap') {
            if (data.password && data.password.includes(':')) {
                const decrypted = tryDecryptWithKey(legacyKey, data.password);
                if (decrypted !== null) {
                    data.password = encryptWithKey(newKey, decrypted);
                    modified = true;
                }
            }
        } else if (file.type === 'gcp') {
            if (data.clientSecret && data.clientSecret.includes(':')) {
                const decrypted = tryDecryptWithKey(legacyKey, data.clientSecret);
                if (decrypted !== null) {
                    data.clientSecret = encryptWithKey(newKey, decrypted);
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(file.path, JSON.stringify(data, null, 2));
            console.log(`[Encryption] Legacy migration: migrated ${file.path}`);
        }
    } catch (e) {
        console.error(`[Encryption] Legacy migration: failed to migrate ${file.path}:`, e);
    }
}
