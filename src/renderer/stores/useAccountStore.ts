import { create } from 'zustand';
import type { Account } from '@shared/types';

interface AccountStoreState {
    accounts: Account[];
    activeAccountId: string | null;
    isConnected: boolean;
    loading: boolean;

    loadAccounts: () => Promise<void>;
    setActiveAccount: (accountId: string | null) => Promise<void>;
    addAccount: () => Promise<Account | null>;
    removeAccount: (accountId: string) => Promise<void>;
    checkConnection: () => Promise<void>;
}

export const useAccountStore = create<AccountStoreState>((set, get) => ({
    accounts: [],
    activeAccountId: null,
    isConnected: false,
    loading: false,

    loadAccounts: async () => {
        set({ loading: true });
        try {
            const accounts = await window.mailvalet.getAccounts();
            const state = await window.mailvalet.getAppState();
            const activeId =
                state.lastAccountId && accounts.some(a => a.id === state.lastAccountId)
                    ? state.lastAccountId
                    : accounts[0]?.id || null;
            set({ accounts, activeAccountId: activeId, loading: false });
            if (activeId) {
                const connected = await window.mailvalet.getConnectionStatus(activeId);
                set({ isConnected: connected });
            }
        } catch {
            set({ loading: false });
        }
    },

    setActiveAccount: async accountId => {
        set({ activeAccountId: accountId, isConnected: false });
        if (accountId) {
            await window.mailvalet.saveAppState({ lastAccountId: accountId });
            const connected = await window.mailvalet.getConnectionStatus(accountId);
            set({ isConnected: connected });
        }
    },

    addAccount: async () => {
        try {
            const account = await window.mailvalet.addAccount();
            if (account) {
                await get().loadAccounts();
                set({ activeAccountId: account.id });
                await window.mailvalet.saveAppState({ lastAccountId: account.id });
            }
            return account;
        } catch {
            return null;
        }
    },

    removeAccount: async accountId => {
        await window.mailvalet.removeAccount(accountId);
        const { activeAccountId } = get();
        await get().loadAccounts();
        if (activeAccountId === accountId) {
            const accounts = get().accounts;
            const newActive = accounts[0]?.id || null;
            set({ activeAccountId: newActive });
            if (newActive) await window.mailvalet.saveAppState({ lastAccountId: newActive });
        }
    },

    checkConnection: async () => {
        const { activeAccountId } = get();
        if (!activeAccountId) {
            set({ isConnected: false });
            return;
        }
        try {
            const connected = await window.mailvalet.getConnectionStatus(activeAccountId);
            set({ isConnected: connected });
        } catch {
            set({ isConnected: false });
        }
    },
}));
