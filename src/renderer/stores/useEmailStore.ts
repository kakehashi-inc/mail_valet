import { create } from 'zustand';
import type {
    SamplingResult,
    SamplingMeta,
    FetchMode,
    FromGroup,
    SubjectGroup,
    GroupMode,
    FetchProgress,
    AIProgress,
    AIJudgment,
    EmailMessage,
} from '@shared/types';

type SortKey = 'count' | 'frequency' | 'name' | 'date';

interface EmailStoreState {
    samplingResult: SamplingResult | null;
    samplingMeta: SamplingMeta | null;
    fetchMode: FetchMode;
    groupMode: GroupMode;
    fromGroups: FromGroup[];
    subjectGroups: SubjectGroup[];
    selectedGroupKeys: Set<string>;
    sortKey: SortKey;
    sortAsc: boolean;
    searchQuery: string;
    aiFilterMarketing: [number, number];
    aiFilterSpam: [number, number];
    fetchProgress: FetchProgress | null;
    aiProgress: AIProgress | null;
    isFetching: boolean;
    isJudging: boolean;

    setFetchMode: (mode: FetchMode) => void;
    setGroupMode: (mode: GroupMode, accountId?: string) => void;
    loadGroupMode: (accountId: string) => Promise<void>;
    loadCachedResult: (accountId: string, mode?: FetchMode) => Promise<void>;
    fetchEmails: (accountId: string, startDate?: string, endDate?: string, useDays?: boolean) => Promise<void>;
    cancelFetch: () => Promise<void>;
    setSortKey: (key: SortKey) => void;
    setSearchQuery: (query: string) => void;
    setAIFilterMarketing: (range: [number, number]) => void;
    setAIFilterSpam: (range: [number, number]) => void;
    toggleGroupSelection: (key: string) => void;
    selectAllGroups: (select: boolean) => void;
    runAIJudgment: (accountId: string) => Promise<void>;
    cancelAIJudgment: () => Promise<void>;
    updateAIScores: (judgments: Map<string, AIJudgment>) => void;
    getFilteredFromGroups: () => FromGroup[];
    getFilteredSubjectGroups: () => SubjectGroup[];
    clear: () => void;
}

function applySort(groups: FromGroup[], key: SortKey, asc: boolean): FromGroup[] {
    const sorted = [...groups];
    sorted.sort((a, b) => {
        let cmp = 0;
        switch (key) {
            case 'count':
                cmp = a.count - b.count;
                break;
            case 'frequency':
                cmp = a.frequency - b.frequency;
                break;
            case 'name':
                cmp = a.fromAddress.localeCompare(b.fromAddress);
                break;
            case 'date':
                cmp = new Date(a.latestDate).getTime() - new Date(b.latestDate).getTime();
                break;
        }
        return asc ? cmp : -cmp;
    });
    return sorted;
}

function applySortSubject(groups: SubjectGroup[], key: SortKey, asc: boolean): SubjectGroup[] {
    const sorted = [...groups];
    sorted.sort((a, b) => {
        let cmp = 0;
        switch (key) {
            case 'count':
                cmp = a.count - b.count;
                break;
            case 'frequency':
                cmp = a.frequency - b.frequency;
                break;
            case 'name':
                cmp = a.subject.localeCompare(b.subject);
                break;
            case 'date':
                cmp = new Date(a.latestDate).getTime() - new Date(b.latestDate).getTime();
                break;
        }
        return asc ? cmp : -cmp;
    });
    return sorted;
}

function recalcAIScoreRange(group: FromGroup): FromGroup {
    const marketingScores = group.messages.filter(m => m.aiJudgment).map(m => m.aiJudgment!.marketing);
    const spamScores = group.messages.filter(m => m.aiJudgment).map(m => m.aiJudgment!.spam);
    return {
        ...group,
        aiScoreRange: {
            marketing:
                marketingScores.length > 0 ? [Math.min(...marketingScores), Math.max(...marketingScores)] : [-1, -1],
            spam: spamScores.length > 0 ? [Math.min(...spamScores), Math.max(...spamScores)] : [-1, -1],
        },
    };
}

function buildSubjectGroupsFromMessages(messages: EmailMessage[], periodDays: number): SubjectGroup[] {
    const groups = new Map<string, EmailMessage[]>();
    for (const msg of messages) {
        const key = msg.subject.toLowerCase().trim() || '(no subject)';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(msg);
    }

    return Array.from(groups.entries()).map(([key, msgs]) => {
        const addrSet = new Set<string>();
        msgs.forEach(m => addrSet.add(m.fromAddress));
        const fromAddresses = Array.from(addrSet);
        const sorted = [...msgs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const otherCount = fromAddresses.length - 1;
        const fromSummary = otherCount > 0 ? `${fromAddresses[0]} 他${otherCount}件` : fromAddresses[0] || '';

        const marketingScores = msgs.filter(m => m.aiJudgment).map(m => m.aiJudgment!.marketing);
        const spamScores = msgs.filter(m => m.aiJudgment).map(m => m.aiJudgment!.spam);

        return {
            subject: key,
            displaySubject: sorted[0]?.subject || key,
            fromSummary,
            fromAddresses,
            count: msgs.length,
            frequency: periodDays > 0 ? Math.round((msgs.length / periodDays) * 10) / 10 : msgs.length,
            latestDate: sorted[0]?.date || '',
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
        };
    });
}

function computePeriodDays(result: SamplingResult): number {
    return Math.max(
        1,
        Math.round((new Date(result.periodEnd).getTime() - new Date(result.periodStart).getTime()) / 86400000)
    );
}

export const useEmailStore = create<EmailStoreState>((set, get) => ({
    samplingResult: null,
    samplingMeta: null,
    fetchMode: 'days',
    groupMode: 'from',
    fromGroups: [],
    subjectGroups: [],
    selectedGroupKeys: new Set(),
    sortKey: 'count',
    sortAsc: false,
    searchQuery: '',
    aiFilterMarketing: [0, 10],
    aiFilterSpam: [0, 10],
    fetchProgress: null,
    aiProgress: null,
    isFetching: false,
    isJudging: false,

    setFetchMode: mode => set({ fetchMode: mode }),

    setGroupMode: (mode, accountId) => {
        set({ groupMode: mode, selectedGroupKeys: new Set() });
        if (accountId) {
            window.mailvalet.getAppState().then(state => {
                const groupModes = { ...(state.groupModes || {}), [accountId]: mode };
                window.mailvalet.saveAppState({ groupModes });
            });
        }
    },

    loadGroupMode: async accountId => {
        const state = await window.mailvalet.getAppState();
        const mode = state.groupModes?.[accountId] || 'from';
        set({ groupMode: mode, selectedGroupKeys: new Set() });
    },

    loadCachedResult: async (accountId, mode) => {
        const m = mode ?? get().fetchMode;
        const cached = await window.mailvalet.getCachedResult(accountId, m);
        if (cached) {
            const groups = cached.result.fromGroups.map(recalcAIScoreRange);
            const periodDays = computePeriodDays(cached.result);
            const subjGroups = buildSubjectGroupsFromMessages(cached.result.messages, periodDays);
            set({
                samplingResult: cached.result,
                samplingMeta: cached.meta,
                fromGroups: applySort(groups, get().sortKey, get().sortAsc),
                subjectGroups: applySortSubject(subjGroups, get().sortKey, get().sortAsc),
                selectedGroupKeys: new Set(),
            });
        } else {
            set({
                samplingResult: null,
                samplingMeta: null,
                fromGroups: [],
                subjectGroups: [],
                selectedGroupKeys: new Set(),
            });
        }
    },

    fetchEmails: async (accountId, startDate, endDate, useDays) => {
        const mode: FetchMode = useDays ? 'days' : 'range';
        set({ isFetching: true, fetchProgress: null, fetchMode: mode });
        const unsubscribe = window.mailvalet.onFetchProgress(progress => {
            set({ fetchProgress: progress });
        });
        try {
            const result = await window.mailvalet.fetchEmails({ accountId, startDate, endDate, useDays });
            const groups = result.fromGroups.map(recalcAIScoreRange);
            const periodDays = computePeriodDays(result);
            const subjGroups = buildSubjectGroupsFromMessages(result.messages, periodDays);
            set({
                samplingResult: result,
                fromGroups: applySort(groups, get().sortKey, get().sortAsc),
                subjectGroups: applySortSubject(subjGroups, get().sortKey, get().sortAsc),
                selectedGroupKeys: new Set(),
                isFetching: false,
                fetchProgress: null,
            });
            // Reload meta
            const cached = await window.mailvalet.getCachedResult(accountId, mode);
            if (cached) set({ samplingMeta: cached.meta });
        } catch (e) {
            set({ isFetching: false, fetchProgress: null });
            // If cancelled, silently absorb
            if (e instanceof Error && e.message === 'Fetch cancelled') return;
            throw e;
        } finally {
            unsubscribe();
        }
    },

    cancelFetch: async () => {
        await window.mailvalet.cancelFetch();
        set({ isFetching: false, fetchProgress: null });
    },

    setSortKey: key => {
        const { sortKey, sortAsc, fromGroups, subjectGroups } = get();
        const newAsc = sortKey === key ? !sortAsc : false;
        set({
            sortKey: key,
            sortAsc: newAsc,
            fromGroups: applySort(fromGroups, key, newAsc),
            subjectGroups: applySortSubject(subjectGroups, key, newAsc),
        });
    },

    setSearchQuery: query => set({ searchQuery: query }),
    setAIFilterMarketing: range => set({ aiFilterMarketing: range }),
    setAIFilterSpam: range => set({ aiFilterSpam: range }),

    toggleGroupSelection: key => {
        const selected = new Set(get().selectedGroupKeys);
        if (selected.has(key)) selected.delete(key);
        else selected.add(key);
        set({ selectedGroupKeys: selected });
    },

    selectAllGroups: select => {
        if (select) {
            const { groupMode } = get();
            if (groupMode === 'from') {
                const filtered = get().getFilteredFromGroups();
                set({ selectedGroupKeys: new Set(filtered.map(g => g.fromAddress)) });
            } else {
                const filtered = get().getFilteredSubjectGroups();
                set({ selectedGroupKeys: new Set(filtered.map(g => g.subject)) });
            }
        } else {
            set({ selectedGroupKeys: new Set() });
        }
    },

    runAIJudgment: async accountId => {
        const { samplingResult, fetchMode } = get();
        if (!samplingResult) return;
        set({ isJudging: true, aiProgress: null });
        const unsubscribe = window.mailvalet.onAIProgress(progress => {
            set({ aiProgress: progress });
        });
        try {
            const allIds = samplingResult.messages.map(m => m.id);
            await window.mailvalet.runAIJudgment(accountId, allIds, fetchMode);
            // Reload cached result to get updated AI scores
            await get().loadCachedResult(accountId, fetchMode);
        } finally {
            set({ isJudging: false, aiProgress: null });
            unsubscribe();
        }
    },

    cancelAIJudgment: async () => {
        await window.mailvalet.cancelAIJudgment();
        set({ isJudging: false, aiProgress: null });
    },

    updateAIScores: judgments => {
        const { fromGroups, samplingResult } = get();
        const updated = fromGroups.map(group => {
            const updatedMessages = group.messages.map(msg => {
                const judgment = judgments.get(msg.id);
                return judgment ? { ...msg, aiJudgment: judgment } : msg;
            });
            return recalcAIScoreRange({ ...group, messages: updatedMessages });
        });
        set({ fromGroups: updated });

        // Also update subject groups
        if (samplingResult) {
            const periodDays = computePeriodDays(samplingResult);
            const allMessages = samplingResult.messages.map(msg => {
                const judgment = judgments.get(msg.id);
                return judgment ? { ...msg, aiJudgment: judgment } : msg;
            });
            const subjGroups = buildSubjectGroupsFromMessages(allMessages, periodDays);
            set({ subjectGroups: applySortSubject(subjGroups, get().sortKey, get().sortAsc) });
        }
    },

    getFilteredFromGroups: () => {
        const { fromGroups, searchQuery, aiFilterMarketing, aiFilterSpam } = get();
        return fromGroups.filter(g => {
            // Text filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchAddress = g.fromAddress.toLowerCase().includes(q);
                const matchNames = g.fromNames.some(n => n.toLowerCase().includes(q));
                if (!matchAddress && !matchNames) return false;
            }
            // AI filter (only apply if group has AI scores)
            if (g.aiScoreRange.marketing[0] >= 0) {
                if (
                    g.aiScoreRange.marketing[1] < aiFilterMarketing[0] ||
                    g.aiScoreRange.marketing[0] > aiFilterMarketing[1]
                )
                    return false;
            }
            if (g.aiScoreRange.spam[0] >= 0) {
                if (g.aiScoreRange.spam[1] < aiFilterSpam[0] || g.aiScoreRange.spam[0] > aiFilterSpam[1]) return false;
            }
            return true;
        });
    },

    getFilteredSubjectGroups: () => {
        const { subjectGroups, searchQuery, aiFilterMarketing, aiFilterSpam } = get();
        return subjectGroups.filter(g => {
            // Text filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const matchSubject = g.subject.includes(q);
                const matchFrom = g.fromSummary.toLowerCase().includes(q);
                if (!matchSubject && !matchFrom) return false;
            }
            // AI filter
            if (g.aiScoreRange.marketing[0] >= 0) {
                if (
                    g.aiScoreRange.marketing[1] < aiFilterMarketing[0] ||
                    g.aiScoreRange.marketing[0] > aiFilterMarketing[1]
                )
                    return false;
            }
            if (g.aiScoreRange.spam[0] >= 0) {
                if (g.aiScoreRange.spam[1] < aiFilterSpam[0] || g.aiScoreRange.spam[0] > aiFilterSpam[1]) return false;
            }
            return true;
        });
    },

    clear: () =>
        set({
            samplingResult: null,
            samplingMeta: null,
            fromGroups: [],
            subjectGroups: [],
            selectedGroupKeys: new Set(),
            fetchProgress: null,
            aiProgress: null,
        }),
}));
