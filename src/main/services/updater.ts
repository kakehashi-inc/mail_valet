import { BrowserWindow } from 'electron';
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater';
import { IPC_CHANNELS } from '../../shared/constants';
import type { UpdateState } from '../../shared/types';

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
// Portable builds expose PORTABLE_EXECUTABLE_FILE at runtime. Auto-update must be
// skipped in that case because electron-updater would otherwise download and run
// the NSIS installer, dropping a regular installation in an unexpected location.
const isPortable = !!process.env.PORTABLE_EXECUTABLE_FILE;
const isUpdaterDisabled = isDev || isPortable;

const AUTO_INSTALL_DELAY_MS = 1500;

let initialized = false;
let startupCheckScheduled = false;
let currentState: UpdateState = { status: 'idle' };
let autoInstallOnDownloaded = false;

function broadcastState() {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.UPDATER_STATE_CHANGED, currentState);
        }
    }
}

function setState(next: UpdateState, broadcast: boolean) {
    currentState = next;
    if (broadcast) broadcastState();
}

export function getUpdateState(): UpdateState {
    return currentState;
}

export function initializeUpdater() {
    if (isUpdaterDisabled) return;
    if (initialized) return;
    initialized = true;

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.logger = console;

    autoUpdater.on('checking-for-update', () => {
        // Internal state only; no broadcast.
        currentState = { status: 'checking' };
    });

    autoUpdater.on('update-available', (info: UpdateInfo) => {
        setState({ status: 'available', version: info.version }, true);
    });

    autoUpdater.on('update-not-available', () => {
        // Internal state only; UI stays silent when there is nothing to show.
        currentState = { status: 'not-available' };
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
        setState(
            {
                status: 'downloading',
                version: currentState.version,
                progress: progress.percent,
            },
            true
        );
    });

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
        setState({ status: 'downloaded', version: info.version }, true);
        if (autoInstallOnDownloaded) {
            setTimeout(() => {
                quitAndInstall();
            }, AUTO_INSTALL_DELAY_MS);
        }
    });

    autoUpdater.on('error', (err: Error) => {
        console.error('[updater] error', err);
        autoInstallOnDownloaded = false;
        setState({ status: 'idle' }, true);
    });
}

export async function checkForUpdates() {
    if (isUpdaterDisabled) return;
    if (!initialized) return;
    try {
        await autoUpdater.checkForUpdates();
    } catch (err) {
        console.error('[updater] checkForUpdates failed', err);
    }
}

export async function downloadUpdate() {
    if (isUpdaterDisabled) return;
    if (!initialized) return;
    autoInstallOnDownloaded = true;
    try {
        await autoUpdater.downloadUpdate();
    } catch (err) {
        autoInstallOnDownloaded = false;
        console.error('[updater] downloadUpdate failed', err);
    }
}

export function quitAndInstall() {
    if (isUpdaterDisabled) return;
    if (!initialized) return;
    setImmediate(() => {
        for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) win.close();
        }
        autoUpdater.quitAndInstall(false, true);
    });
}

export function scheduleStartupCheck(window: BrowserWindow, delayMs = 3000) {
    if (isUpdaterDisabled) return;
    if (startupCheckScheduled) return;
    startupCheckScheduled = true;

    const run = () => {
        setTimeout(() => {
            void checkForUpdates();
        }, delayMs);
    };

    if (window.webContents.isLoading()) {
        window.webContents.once('did-finish-load', run);
    } else {
        run();
    }
}
