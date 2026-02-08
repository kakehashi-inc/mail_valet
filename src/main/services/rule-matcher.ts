import type { EmailMessage, EmailBodyParts, RuleLine, RulePattern, AccountRules, RuleGroup } from '../../shared/types';

/**
 * Check if a single pattern matches the given content.
 */
function matchesPattern(pattern: RulePattern, subject: string, bodyParts: EmailBodyParts): boolean {
    try {
        const regex = new RegExp(pattern.regex, 'i');

        switch (pattern.field) {
            case 'subject':
                return regex.test(subject);
            case 'body':
                return regex.test(bodyParts.html) || regex.test(bodyParts.plain);
            case 'any':
                return regex.test(subject) || regex.test(bodyParts.html) || regex.test(bodyParts.plain);
            default:
                return false;
        }
    } catch {
        return false;
    }
}

/**
 * Check if all patterns in a rule line match (AND condition).
 */
export function matchesRuleLine(ruleLine: RuleLine, subject: string, bodyParts: EmailBodyParts): boolean {
    return ruleLine.patterns.every(pattern => matchesPattern(pattern, subject, bodyParts));
}

/**
 * Check if any rule line in the account rules matches (OR condition).
 * Returns the index of the first matching rule line, or -1 if none match.
 */
export function findMatchingRuleIndex(rules: AccountRules, subject: string, bodyParts: EmailBodyParts): number {
    for (let i = 0; i < rules.lines.length; i++) {
        if (matchesRuleLine(rules.lines[i], subject, bodyParts)) {
            return i;
        }
    }
    return -1;
}

/**
 * Build rule groups from messages using the account rules.
 * Only groups with count > 0 are returned.
 */
export function buildRuleGroups(
    messages: EmailMessage[],
    bodyPartsMap: Record<string, EmailBodyParts>,
    rules: AccountRules,
    periodDays: number
): RuleGroup[] {
    // Map from rule index to messages
    const groupMap = new Map<number, EmailMessage[]>();

    for (const msg of messages) {
        const bodyParts = bodyPartsMap[msg.id] || { plain: '', html: '' };
        const ruleIndex = findMatchingRuleIndex(rules, msg.subject, bodyParts);

        if (ruleIndex >= 0) {
            if (!groupMap.has(ruleIndex)) {
                groupMap.set(ruleIndex, []);
            }
            groupMap.get(ruleIndex)!.push(msg);
        }
    }

    // Build RuleGroup array (only non-empty groups)
    const groups: RuleGroup[] = [];

    for (const [ruleIndex, msgs] of groupMap.entries()) {
        if (msgs.length === 0) continue;

        const ruleLine = rules.lines[ruleIndex];

        // Sort messages by date (newest first)
        const sorted = [...msgs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Calculate refFrom (most frequent sender)
        const fromCounts = new Map<string, number>();
        for (const m of msgs) {
            fromCounts.set(m.fromAddress, (fromCounts.get(m.fromAddress) || 0) + 1);
        }
        let refFrom = '';
        let maxCount = 0;
        for (const [addr, count] of fromCounts.entries()) {
            if (count > maxCount) {
                maxCount = count;
                refFrom = addr;
            }
        }

        // Calculate refSubject (latest subject)
        const refSubject = sorted[0]?.subject || '';

        // Calculate AI score ranges
        const marketingScores = msgs.filter(m => m.aiJudgment).map(m => m.aiJudgment!.marketing);
        const spamScores = msgs.filter(m => m.aiJudgment).map(m => m.aiJudgment!.spam);

        groups.push({
            ruleKey: `rule:${ruleIndex}`,
            ruleText: ruleLine.rawText,
            ruleLine,
            count: msgs.length,
            frequency: periodDays > 0 ? Math.round((msgs.length / periodDays) * 10) / 10 : msgs.length,
            latestDate: sorted[0]?.date || '',
            refFrom,
            refSubject,
            messages: sorted,
            aiScoreRange: {
                marketing:
                    marketingScores.length > 0
                        ? ([Math.min(...marketingScores), Math.max(...marketingScores)] as [number, number])
                        : ([-1, -1] as [number, number]),
                spam:
                    spamScores.length > 0
                        ? ([Math.min(...spamScores), Math.max(...spamScores)] as [number, number])
                        : ([-1, -1] as [number, number]),
            },
        });
    }

    // Sort groups by rule index
    groups.sort((a, b) => {
        const aIdx = parseInt(a.ruleKey.split(':')[1], 10);
        const bIdx = parseInt(b.ruleKey.split(':')[1], 10);
        return aIdx - bIdx;
    });

    return groups;
}
