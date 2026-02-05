import type { IpcApi } from '@shared/ipc';

declare global {
    interface Window {
        mailvalet: IpcApi;
    }
}
