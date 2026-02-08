import type { RuleLine, RulePattern, RulePatternField, AccountRules } from '../../shared/types';

/**
 * Parse rule text into structured AccountRules.
 *
 * Rule syntax:
 * - subject:"regex"         Match subject only
 * - body:"regex"            Match body (html or plain)
 * - "regex"                 Match any field (subject, body-html, body-plain)
 * - subject:["r1", "r2"]    Array syntax (AND condition)
 * - Multiple patterns on same line = AND condition
 * - Separate lines = OR condition
 */
export function parseRuleText(ruleText: string): AccountRules {
    const lines: RuleLine[] = [];
    const rawLines = ruleText.split('\n');

    for (let i = 0; i < rawLines.length; i++) {
        const rawLine = rawLines[i].trim();
        if (!rawLine || rawLine.startsWith('#')) {
            continue;
        }

        const patterns = parseRuleLine(rawLine);
        if (patterns.length > 0) {
            lines.push({
                patterns,
                lineIndex: i,
                rawText: rawLine,
            });
        }
    }

    return { ruleText, lines };
}

/**
 * Parse a single rule line into patterns.
 * All patterns on the same line form an AND condition.
 */
function parseRuleLine(line: string): RulePattern[] {
    const patterns: RulePattern[] = [];
    let remaining = line;

    while (remaining.length > 0) {
        remaining = remaining.trimStart();
        if (remaining.length === 0) break;

        const result = parseNextPattern(remaining);
        if (result) {
            patterns.push(...result.patterns);
            remaining = result.remaining;
        } else {
            break;
        }
    }

    return patterns;
}

interface ParseResult {
    patterns: RulePattern[];
    remaining: string;
}

/**
 * Parse the next pattern from the beginning of a string.
 */
function parseNextPattern(input: string): ParseResult | null {
    const trimmed = input.trimStart();

    // Check for field prefix: subject: or body:
    const fieldMatch = trimmed.match(/^(subject|body):/i);
    let field: RulePatternField = 'any';
    let afterField = trimmed;

    if (fieldMatch) {
        field = fieldMatch[1].toLowerCase() as 'subject' | 'body';
        afterField = trimmed.slice(fieldMatch[0].length);
    }

    // Check for array syntax: ["...", "..."]
    if (afterField.startsWith('[')) {
        const arrayResult = parseArraySyntax(afterField, field);
        if (arrayResult) {
            return arrayResult;
        }
    }

    // Check for quoted string: "..."
    if (afterField.startsWith('"')) {
        const quoteResult = parseQuotedString(afterField, field);
        if (quoteResult) {
            return quoteResult;
        }
    }

    return null;
}

/**
 * Parse array syntax: ["pattern1", "pattern2", ...]
 */
function parseArraySyntax(input: string, field: RulePatternField): ParseResult | null {
    if (!input.startsWith('[')) return null;

    let depth = 0;
    let endIdx = -1;

    for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === '[') depth++;
        else if (ch === ']') {
            depth--;
            if (depth === 0) {
                endIdx = i;
                break;
            }
        }
    }

    if (endIdx === -1) return null;

    const arrayContent = input.slice(1, endIdx);
    const patterns: RulePattern[] = [];

    // Extract all quoted strings from the array
    const regex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let match;
    while ((match = regex.exec(arrayContent)) !== null) {
        patterns.push({
            field,
            regex: unescapeString(match[1]),
        });
    }

    return {
        patterns,
        remaining: input.slice(endIdx + 1),
    };
}

/**
 * Parse a quoted string: "..."
 */
function parseQuotedString(input: string, field: RulePatternField): ParseResult | null {
    if (!input.startsWith('"')) return null;

    let endIdx = -1;
    let escaped = false;

    for (let i = 1; i < input.length; i++) {
        const ch = input[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\') {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            endIdx = i;
            break;
        }
    }

    if (endIdx === -1) return null;

    const content = input.slice(1, endIdx);
    return {
        patterns: [
            {
                field,
                regex: unescapeString(content),
            },
        ],
        remaining: input.slice(endIdx + 1),
    };
}

/**
 * Unescape a string (handle \\, \", etc.)
 */
function unescapeString(str: string): string {
    return str.replace(/\\(.)/g, '$1');
}

/**
 * Validate a regex pattern.
 * Returns null if valid, or an error message if invalid.
 */
export function validateRegex(pattern: string): string | null {
    try {
        new RegExp(pattern, 'i');
        return null;
    } catch (e) {
        return e instanceof Error ? e.message : String(e);
    }
}

/**
 * Validate all patterns in an AccountRules.
 * Returns an array of { lineIndex, error } for each invalid pattern.
 */
export function validateRules(rules: AccountRules): { lineIndex: number; error: string }[] {
    const errors: { lineIndex: number; error: string }[] = [];

    for (const line of rules.lines) {
        for (const pattern of line.patterns) {
            const error = validateRegex(pattern.regex);
            if (error) {
                errors.push({ lineIndex: line.lineIndex, error });
            }
        }
    }

    return errors;
}
