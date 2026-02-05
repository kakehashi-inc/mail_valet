import type { AppState } from '../../shared/types';
import { getAppStatePath } from '../../shared/constants';
import { readJsonFile, writeJsonFile } from './file-manager';

const DEFAULT_APP_STATE: AppState = {
    lastAccountId: null,
    windowBounds: null,
};

export async function getAppState(): Promise<AppState> {
    return readJsonFile<AppState>(getAppStatePath(), DEFAULT_APP_STATE);
}

export async function saveAppState(state: Partial<AppState>): Promise<void> {
    const current = await getAppState();
    const merged = { ...current, ...state };
    await writeJsonFile(getAppStatePath(), merged);
}
