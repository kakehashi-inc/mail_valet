import crypto from 'crypto';
import type { AIJudgment, AIProgress, EmailMessage } from '../../shared/types';
import { getAIJudgmentCachePath } from '../../shared/constants';
import { readJsonFile, writeJsonFile } from './file-manager';
import { getOllamaSettings } from './settings-manager';

type AIJudgmentCache = Record<string, AIJudgment>;
type ProgressCallback = (progress: AIProgress) => void;

let cancelRequested = false;

export function cancelAIJudgment(): void {
    cancelRequested = true;
}

export async function testConnection(host: string): Promise<boolean> {
    try {
        const response = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(10000) });
        return response.ok;
    } catch {
        return false;
    }
}

export async function getModels(host: string): Promise<string[]> {
    try {
        const response = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(10000) });
        if (!response.ok) return [];
        const data = (await response.json()) as any;
        return (data.models || []).map((m: any) => m.name || m.model);
    } catch {
        return [];
    }
}

function computeContentHash(subject: string, body: string): string {
    return crypto.createHash('sha256').update(`${subject}\n${body}`).digest('hex');
}

async function loadAICache(): Promise<AIJudgmentCache> {
    return readJsonFile<AIJudgmentCache>(getAIJudgmentCachePath(), {});
}

async function saveAICache(cache: AIJudgmentCache): Promise<void> {
    await writeJsonFile(getAIJudgmentCachePath(), cache);
}

export async function clearAICache(): Promise<void> {
    await writeJsonFile(getAIJudgmentCachePath(), {});
}

async function judgeEmail(
    host: string,
    model: string,
    timeout: number,
    subject: string,
    body: string
): Promise<AIJudgment> {
    const prompt = `Analyze the following email and rate it on two scales from 0 to 10:
1. Marketing score (0 = not marketing at all, 10 = pure marketing/promotional)
2. Spam score (0 = legitimate email, 10 = clearly spam/junk)

Email subject: ${subject}
Email body (first 1000 chars): ${body.substring(0, 1000)}

Respond ONLY in this exact JSON format, nothing else:
{"marketing": <number>, "spam": <number>}`;

    const timeoutMs = timeout === 0 ? 0 : timeout * 1000;
    const signal = timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

    const response = await fetch(`${host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, stream: false }),
        signal,
    });

    if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
    const data = (await response.json()) as any;
    const responseText = data.response || '';

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error('Failed to parse AI response');
    const parsed = JSON.parse(jsonMatch[0]);
    return {
        marketing: Math.min(10, Math.max(0, Math.round(Number(parsed.marketing) || 0))),
        spam: Math.min(10, Math.max(0, Math.round(Number(parsed.spam) || 0))),
        judgedAt: new Date().toISOString(),
    };
}

export async function runAIJudgment(
    messages: EmailMessage[],
    getBody: (messageId: string) => Promise<string>,
    onProgress?: ProgressCallback
): Promise<Map<string, AIJudgment>> {
    cancelRequested = false;
    const settings = await getOllamaSettings();
    if (!settings.host || !settings.model) throw new Error('Ollama not configured');

    const cache = await loadAICache();
    const results = new Map<string, AIJudgment>();
    const toProcess: { msg: EmailMessage; hash: string }[] = [];

    // Check cache first
    for (const msg of messages) {
        const hash = computeContentHash(msg.subject, msg.body || msg.snippet);
        if (cache[hash]) {
            results.set(msg.id, cache[hash]);
        } else {
            toProcess.push({ msg, hash });
        }
    }

    const total = toProcess.length;
    let processed = 0;
    onProgress?.({ current: processed, total, message: `AI judgment: ${processed}/${total}` });

    // Process in batches based on concurrency
    const concurrency = Math.max(1, settings.concurrency);
    for (let i = 0; i < toProcess.length; i += concurrency) {
        if (cancelRequested) break;
        const batch = toProcess.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(
            batch.map(async ({ msg, hash }) => {
                const body = msg.body || (await getBody(msg.id));
                const judgment = await judgeEmail(settings.host, settings.model, settings.timeout, msg.subject, body);
                return { msgId: msg.id, hash, judgment };
            })
        );
        for (const result of batchResults) {
            if (result.status === 'fulfilled') {
                const { msgId, hash, judgment } = result.value;
                results.set(msgId, judgment);
                cache[hash] = judgment;
            }
        }
        processed += batch.length;
        onProgress?.({
            current: Math.min(processed, total),
            total,
            message: `AI judgment: ${Math.min(processed, total)}/${total}`,
        });
    }

    await saveAICache(cache);
    return results;
}
