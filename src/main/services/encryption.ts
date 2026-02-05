import crypto from 'crypto';
import os from 'os';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT = 'mailvalet-encryption-salt-v1';

function deriveKey(): Buffer {
    const machineId = `${os.hostname()}-${os.userInfo().username}-${SALT}`;
    return crypto.pbkdf2Sync(machineId, SALT, 100000, 32, 'sha256');
}

export function encrypt(text: string): string {
    const key = deriveKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
}

export function decrypt(encryptedText: string): string {
    const key = deriveKey();
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
