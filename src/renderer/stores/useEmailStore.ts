import { create } from 'zustand';
import type { SamplingResult, SamplingMeta, FromGroup, FetchProgress, AIProgress, AIJudgment } from '@shared/types';

type SortKey = 'count' | 'frequency' | 'name' | 'date';

interface EmailStoreState {
    samplingResult: SamplingResult | null;
    samplingMeta: SamplingMeta | null;
    fromGroups: FromGroup[];
    selectedFromAddresses: Set<string>;
    sortKey: SortKey;
    sortAsc: boolean;
    searchQuery: string;
    aiFilterMarketing: [number, number];
    aiFilterSpam: [number, number];
    fetchProgress: FetchProgress | null;
    aiProgress: AIProgress | null;
    isFetching: boolean;
    isJudging: boolean;

    loadCachedResult: (accountId: string) => Promise<void>;
    fetchEmails: (accountId: string, startDate?: string, endDate?: string, useDays?: boolean) => Promise<void>;
    setSortKey: (key: SortKey) => void;
    setSearchQuery: (query: string) => void;
    setAIFilterMarketing: (range: [number, number]) => void;
    setAIFilterSpam: (range: [number, number]) => void;
    toggleFromSelection: (fromAddress: string) => void;
    selectAllFrom: (select: boolean) => void;
    runAIJudgment: (accountId: string) => Promise<void>;
    cancelAIJudgment: () => Promise<void>;
    updateAIScores: (judgments: Map<string, AIJudgment>) => void;
    getFilteredGroups: () => FromGroup[];
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

export const useEmailStore = create<EmailStoreState>((set, get) => ({
    samplingResult: null,
    samplingMeta: null,
    fromGroups: [],
    selectedFromAddresses: new Set(),
    sortKey: 'count',
    sortAsc: false,
    searchQuery: '',
    aiFilterMarketing: [0, 10],
    aiFilterSpam: [0, 10],
    fetchProgress: null,
    aiProgress: null,
    isFetching: false,
    isJudging: false,

    loadCachedResult: async accountId => {
        const cached = await window.mailvalet.getCachedResult(accountId);
        if (cached) {
            const groups = cached.result.fromGroups.map(recalcAIScoreRange);
            set({
                samplingResult: cached.result,
                samplingMeta: cached.meta,
                fromGroups: applySort(groups, get().sortKey, get().sortAsc),
                selectedFromAddresses: new Set(),
            });
        } else {
            set({ samplingResult: null, samplingMeta: null, fromGroups: [], selectedFromAddresses: new Set() });
        }
    },

    fetchEmails: async (accountId, startDate, endDate, useDays) => {
        set({ isFetching: true, fetchProgress: null });
        const unsubscribe = window.mailvalet.onFetchProgress(progress => {
            set({ fetchProgress: progress });
        });
        try {
            const result = await window.mailvalet.fetchEmails({ accountId, startDate, endDate, useDays });
            const groups = result.fromGroups.map(recalcAIScoreRange);
            set({
                samplingResult: result,
                fromGroups: applySort(groups, get().sortKey, get().sortAsc),
                selectedFromAddresses: new Set(),
                isFetching: false,
                fetchProgress: null,
            });
            // Reload meta
            const cached = await window.mailvalet.getCachedResult(accountId);
            if (cached) set({ samplingMeta: cached.meta });
        } catch (e) {
            set({ isFetching: false, fetchProgress: null });
            throw e;
        } finally {
            unsubscribe();
        }
    },

    setSortKey: key => {
        const { sortKey, sortAsc, fromGroups } = get();
        const newAsc = sortKey === key ? !sortAsc : false;
        set({ sortKey: key, sortAsc: newAsc, fromGroups: applySort(fromGroups, key, newAsc) });
    },

    setSearchQuery: query => set({ searchQuery: query }),
    setAIFilterMarketing: range => set({ aiFilterMarketing: range }),
    setAIFilterSpam: range => set({ aiFilterSpam: range }),

    toggleFromSelection: fromAddress => {
        const selected = new Set(get().selectedFromAddresses);
        if (selected.has(fromAddress)) selected.delete(fromAddress);
        else selected.add(fromAddress);
        set({ selectedFromAddresses: selected });
    },

    selectAllFrom: select => {
        if (select) {
            const filtered = get().getFilteredGroups();
            set({ selectedFromAddresses: new Set(filtered.map(g => g.fromAddress)) });
        } else {
            set({ selectedFromAddresses: new Set() });
        }
    },

    runAIJudgment: async accountId => {
        const { samplingResult } = get();
        if (!samplingResult) return;
        set({ isJudging: true, aiProgress: null });
        const unsubscribe = window.mailvalet.onAIProgress(progress => {
            set({ aiProgress: progress });
        });
        try {
            const allIds = samplingResult.messages.map(m => m.id);
            await window.mailvalet.runAIJudgment(accountId, allIds);
            // Reload cached result to get updated AI scores
            await get().loadCachedResult(accountId);
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
        const { fromGroups } = get();
        const updated = fromGroups.map(group => {
            const updatedMessages = group.messages.map(msg => {
                const judgment = judgments.get(msg.id);
                return judgment ? { ...msg, aiJudgment: judgment } : msg;
            });
            return recalcAIScoreRange({ ...group, messages: updatedMessages });
        });
        set({ fromGroups: updated });
    },

    getFilteredGroups: () => {
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

    clear: () =>
        set({
            samplingResult: null,
            samplingMeta: null,
            fromGroups: [],
            selectedFromAddresses: new Set(),
            fetchProgress: null,
            aiProgress: null,
        }),
}));
