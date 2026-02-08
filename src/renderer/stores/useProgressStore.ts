import { create } from 'zustand';
import type { FetchProgress, AIProgress } from '@shared/types';

interface ProgressStoreState {
    fetchProgress: FetchProgress | null;
    aiProgress: AIProgress | null;
}

export const useProgressStore = create<ProgressStoreState>(() => ({
    fetchProgress: null,
    aiProgress: null,
}));
