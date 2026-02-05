import fs from 'fs/promises';
import path from 'path';
import {
    getAppRootDir,
    getSettingsDir,
    getAccountsDir,
    getCacheDir,
    getStateDir,
    getLogsDir,
} from '../../shared/constants';

export async function ensureDirectories(): Promise<void> {
    const dirs = [getAppRootDir(), getSettingsDir(), getAccountsDir(), getCacheDir(), getStateDir(), getLogsDir()];
    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }
}

export async function ensureDir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
}

export async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
    try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as T;
    } catch {
        return defaultValue;
    }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function deleteFile(filePath: string): Promise<void> {
    try {
        await fs.unlink(filePath);
    } catch {
        // File doesn't exist, ignore
    }
}

export async function deleteDir(dirPath: string): Promise<void> {
    try {
        await fs.rm(dirPath, { recursive: true, force: true });
    } catch {
        // Directory doesn't exist, ignore
    }
}

export async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function listDirectories(parentDir: string): Promise<string[]> {
    try {
        const entries = await fs.readdir(parentDir, { withFileTypes: true });
        return entries.filter(e => e.isDirectory()).map(e => e.name);
    } catch {
        return [];
    }
}
