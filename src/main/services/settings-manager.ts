import type {
    GeneralSettings,
    FetchSettings,
    DeleteSettings,
    OllamaSettings,
    AIJudgmentSettings,
    GcpSettings,
} from '../../shared/types';
import {
    getGeneralSettingsPath,
    getFetchSettingsPath,
    getDeleteSettingsPath,
    getOllamaSettingsPath,
    getAIJudgmentSettingsPath,
    getGcpSettingsPath,
    DEFAULT_GENERAL_SETTINGS,
    DEFAULT_FETCH_SETTINGS,
    DEFAULT_DELETE_SETTINGS,
    DEFAULT_OLLAMA_SETTINGS,
    DEFAULT_AI_JUDGMENT_SETTINGS,
    DEFAULT_GCP_SETTINGS,
} from '../../shared/constants';
import { readJsonFile, writeJsonFile } from './file-manager';
import { encrypt, decrypt } from './encryption';

// General
export async function getGeneralSettings(): Promise<GeneralSettings> {
    return readJsonFile<GeneralSettings>(getGeneralSettingsPath(), DEFAULT_GENERAL_SETTINGS);
}
export async function saveGeneralSettings(settings: GeneralSettings): Promise<void> {
    await writeJsonFile(getGeneralSettingsPath(), settings);
}

// Fetch
export async function getFetchSettings(): Promise<FetchSettings> {
    return readJsonFile<FetchSettings>(getFetchSettingsPath(), DEFAULT_FETCH_SETTINGS);
}
export async function saveFetchSettings(settings: FetchSettings): Promise<void> {
    await writeJsonFile(getFetchSettingsPath(), settings);
}

// Delete
export async function getDeleteSettings(): Promise<DeleteSettings> {
    return readJsonFile<DeleteSettings>(getDeleteSettingsPath(), DEFAULT_DELETE_SETTINGS);
}
export async function saveDeleteSettings(settings: DeleteSettings): Promise<void> {
    await writeJsonFile(getDeleteSettingsPath(), settings);
}

// Ollama
export async function getOllamaSettings(): Promise<OllamaSettings> {
    return readJsonFile<OllamaSettings>(getOllamaSettingsPath(), DEFAULT_OLLAMA_SETTINGS);
}
export async function saveOllamaSettings(settings: OllamaSettings): Promise<void> {
    await writeJsonFile(getOllamaSettingsPath(), settings);
}

// AI Judgment
export async function getAIJudgmentSettings(): Promise<AIJudgmentSettings> {
    return readJsonFile<AIJudgmentSettings>(getAIJudgmentSettingsPath(), DEFAULT_AI_JUDGMENT_SETTINGS);
}
export async function saveAIJudgmentSettings(settings: AIJudgmentSettings): Promise<void> {
    await writeJsonFile(getAIJudgmentSettingsPath(), settings);
}

// GCP (client_secret is encrypted)
export async function getGcpSettings(): Promise<GcpSettings> {
    const raw = await readJsonFile<any>(getGcpSettingsPath(), null);
    if (!raw) return DEFAULT_GCP_SETTINGS;
    try {
        return {
            clientId: raw.clientId || '',
            clientSecret: raw.clientSecret ? decrypt(raw.clientSecret) : '',
            projectId: raw.projectId || '',
        };
    } catch {
        return { clientId: raw.clientId || '', clientSecret: '', projectId: raw.projectId || '' };
    }
}
export async function saveGcpSettings(settings: GcpSettings): Promise<void> {
    const encrypted = {
        clientId: settings.clientId,
        clientSecret: settings.clientSecret ? encrypt(settings.clientSecret) : '',
        projectId: settings.projectId,
    };
    await writeJsonFile(getGcpSettingsPath(), encrypted);
}

// Export all settings (excluding secrets)
export async function exportAllSettings(): Promise<string> {
    const general = await getGeneralSettings();
    const fetchSettings = await getFetchSettings();
    const deleteSettings = await getDeleteSettings();
    const ollama = await getOllamaSettings();
    const aiJudgment = await getAIJudgmentSettings();
    return JSON.stringify({ general, fetch: fetchSettings, delete: deleteSettings, ollama, aiJudgment }, null, 2);
}

// Import settings from JSON
export async function importAllSettings(json: string): Promise<void> {
    const data = JSON.parse(json);
    if (data.general) await saveGeneralSettings(data.general);
    if (data.fetch) await saveFetchSettings(data.fetch);
    if (data.delete) await saveDeleteSettings(data.delete);
    if (data.ollama) await saveOllamaSettings(data.ollama);
}
