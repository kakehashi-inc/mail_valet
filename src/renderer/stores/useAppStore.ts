import { create } from 'zustand';
import type { AppInfo } from '@shared/types';

interface AppStoreState {
    info: AppInfo | null;
    isDetailView: boolean;
    settingsOpen: boolean;
    statusMessage: string;
    initialize: () => Promise<void>;
    updateInfo: (partial: Partial<AppInfo>) => void;
    setSettingsOpen: (open: boolean) => void;
    setStatusMessage: (message: string) => void;
}

export const useAppStore = create<AppStoreState>((set, get) => ({
    info: null,
    isDetailView: false,
    settingsOpen: false,
    statusMessage: '',

    initialize: async () => {
        const info = await window.mailvalet.getAppInfo();
        const params = new URLSearchParams(window.location.search);
        const isDetailView = params.get('detail') === '1';
        set({ info, isDetailView });
    },

    updateInfo: partial => {
        const current = get().info;
        if (current) set({ info: { ...current, ...partial } });
    },

    setSettingsOpen: open => set({ settingsOpen: open }),
    setStatusMessage: message => set({ statusMessage: message }),
}));
