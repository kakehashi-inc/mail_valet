import crypto from 'crypto';
import type { AIJudgment, AIProgress, EmailMessage, EmailBodyParts } from '../../shared/types';
import { getAIJudgmentCachePath } from '../../shared/constants';
import { readJsonFile, writeJsonFile } from './file-manager';
import { getOllamaSettings, getAIJudgmentSettings } from './settings-manager';

// Language code → English full name (for LLM prompt)
const LANGUAGE_NAMES: Record<string, string> = {
    ja: 'Japanese',
    en: 'English',
    zh: 'Chinese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic',
    it: 'Italian',
    th: 'Thai',
    vi: 'Vietnamese',
};

type AIJudgmentCache = Record<string, AIJudgment>;
type ProgressCallback = (progress: AIProgress) => void;

// Cache TTL: 30 days
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Body content sent to Ollama is truncated to this length.
// 4000 chars is a reasonable budget for a single body that leaves room for the
// prompt instructions and the model's response within typical context windows.
const MAX_BODY_LENGTH = 4000;

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

// ---------------------------------------------------------------------------
// Body content selection
// ---------------------------------------------------------------------------

// Extract inner content of <body> tag. If no <body> tag exists, return the
// entire HTML as-is (some emails omit the wrapping tags).
function extractHtmlBody(html: string): string {
    const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return (match ? match[1] : html).trim();
}

// Compact HTML for LLM consumption: remove comments, collapse whitespace.
// Tags and attributes (style, class, href, src, etc.) are preserved as-is
// because they serve as classification signals.
function compactHtml(html: string): string {
    return html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\r?\n/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/>\s+</g, '><')
        .replace(/ {2,}/g, ' ')
        .trim();
}

type SelectedBody = { content: string; type: 'html' | 'plain' | 'none' };

// Priority: HTML <body> content (non-empty) > plain text > none (subject only)
function selectBody(bodyParts: EmailBodyParts): SelectedBody {
    if (bodyParts.html) {
        const inner = extractHtmlBody(bodyParts.html);
        if (inner) return { content: compactHtml(inner), type: 'html' };
    }
    if (bodyParts.plain) {
        return { content: bodyParts.plain, type: 'plain' };
    }
    return { content: '', type: 'none' };
}

// ---------------------------------------------------------------------------
// Cache hash — computed from the content actually sent to Ollama
// ---------------------------------------------------------------------------
function computeContentHash(subject: string, bodyContent: string, allowedLanguages: string[]): string {
    let input = `${subject}\n${bodyContent}`;
    if (allowedLanguages.length > 0) {
        input += `\nlang:${[...allowedLanguages].sort().join(',')}`;
    }
    return crypto.createHash('sha256').update(input).digest('hex');
}

async function loadAICache(): Promise<AIJudgmentCache> {
    const cache = await readJsonFile<AIJudgmentCache>(getAIJudgmentCachePath(), {});
    const now = Date.now();
    let cleaned = false;
    for (const hash of Object.keys(cache)) {
        if (new Date(cache[hash].judgedAt).getTime() + CACHE_TTL_MS < now) {
            delete cache[hash];
            cleaned = true;
        }
    }
    if (cleaned) await saveAICache(cache);
    return cache;
}

async function saveAICache(cache: AIJudgmentCache): Promise<void> {
    await writeJsonFile(getAIJudgmentCachePath(), cache);
}

export async function clearAICache(): Promise<void> {
    await writeJsonFile(getAIJudgmentCachePath(), {});
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------
function buildPrompt(
    subject: string,
    bodyContent: string,
    bodyType: 'html' | 'plain' | 'none',
    allowedLanguages: string[]
): string {
    const lines: string[] = [];

    lines.push('You are an email classifier. Analyze the email below and output two integer scores from 0 to 10.');
    lines.push('');
    lines.push('Scoring criteria:');
    lines.push('- marketing (0 = personal or transactional, 10 = pure promotional / newsletter)');
    lines.push('- spam (0 = legitimate, 10 = unsolicited junk / phishing)');

    if (allowedLanguages.length > 0) {
        const names = allowedLanguages.map(code => LANGUAGE_NAMES[code] || code).join(', ');
        lines.push('');
        lines.push(`The user expects emails in: ${names}. Emails in other languages are more likely spam.`);
    }

    if (bodyType === 'html') {
        lines.push('');
        lines.push(
            'The body is raw HTML. Use structural cues as classification signals: ' +
                'tracking pixels (<img> with 1x1 or external analytics src), ' +
                'styled call-to-action buttons, table-based layouts, ' +
                'unsubscribe links, and a high density of hyperlinks.'
        );
    }

    lines.push('');
    lines.push(`Subject: ${subject}`);

    if (bodyContent) {
        const label = bodyType === 'html' ? 'Body (HTML)' : 'Body (text)';
        lines.push('');
        lines.push(`${label}:`);
        lines.push('<<<EMAIL_BODY>>>');
        lines.push(bodyContent);
        lines.push('<<<END_EMAIL_BODY>>>');
    }

    lines.push('');
    lines.push('Respond ONLY with this JSON, nothing else: {"marketing":<0-10>,"spam":<0-10>}');

    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Single email judgment
// ---------------------------------------------------------------------------
async function judgeEmail(host: string, model: string, timeout: number, prompt: string): Promise<AIJudgment> {
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
    getBodyParts: (messageId: string) => Promise<EmailBodyParts>,
    onProgress?: ProgressCallback
): Promise<Map<string, AIJudgment>> {
    cancelRequested = false;
    const settings = await getOllamaSettings();
    if (!settings.host || !settings.model) throw new Error('Ollama not configured');
    const aiJudgmentSettings = await getAIJudgmentSettings();
    const allowedLanguages = aiJudgmentSettings.allowedLanguages;

    const cache = await loadAICache();
    const results = new Map<string, AIJudgment>();
    const toProcess: { msg: EmailMessage; hash: string; prompt: string }[] = [];

    // Phase 1: Fetch body parts, select body, compute hash, check cache
    for (let i = 0; i < messages.length; i++) {
        if (cancelRequested) break;
        const msg = messages[i];
        const bodyParts = await getBodyParts(msg.id);
        const selected = selectBody(bodyParts);
        const truncated = selected.content.substring(0, MAX_BODY_LENGTH);
        const hash = computeContentHash(msg.subject, truncated, allowedLanguages);
        if (cache[hash]) {
            results.set(msg.id, cache[hash]);
        } else {
            const prompt = buildPrompt(msg.subject, truncated, selected.type, allowedLanguages);
            toProcess.push({ msg, hash, prompt });
        }
        onProgress?.({
            current: i + 1,
            total: messages.length,
            message: `Preparing: ${i + 1}/${messages.length} (${results.size} cached)`,
        });
    }

    // Phase 2: AI judgment for uncached messages
    const total = toProcess.length;
    let processed = 0;

    const concurrency = Math.max(1, settings.concurrency);
    for (let i = 0; i < toProcess.length; i += concurrency) {
        if (cancelRequested) break;
        const batch = toProcess.slice(i, i + concurrency);
        const batchResults = await Promise.allSettled(
            batch.map(async ({ msg, hash, prompt }) => {
                const judgment = await judgeEmail(settings.host, settings.model, settings.timeout, prompt);
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
