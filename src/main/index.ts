import path from 'path';
import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron';
import { setupConsoleBridge, setMainWindow } from './utils/console-bridge';
import { registerIpcHandlers, setMainWindowRef } from './ipc/index';
import { ensureDirectories, fileExists } from './services/file-manager';
import { initializeEncryption } from './services/encryption';
import { getAppState, saveAppState } from './services/state-manager';
import { getGeneralSettings, saveGeneralSettings } from './services/settings-manager';
import { IPC_CHANNELS, getGeneralSettingsPath } from '../shared/constants';
import type { AppInfo, AppLanguage, AppTheme, PlatformId } from '../shared/types';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

async function createWindow() {
    const appState = await getAppState();
    const bounds = appState.windowBounds;

    mainWindow = new BrowserWindow({
        width: bounds?.width || 1200,
        height: bounds?.height || 800,
        x: bounds?.x,
        y: bounds?.y,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
        },
        show: false,
    });

    if (bounds?.isMaximized) {
        mainWindow.maximize();
    }

    // Set refs for console bridge and IPC handlers
    setMainWindow(mainWindow);
    setMainWindowRef(mainWindow);

    if (isDev) {
        mainWindow.loadURL('http://localhost:3001');
        try {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        } catch {
            // Ignore DevTools open failure
        }
        mainWindow.webContents.on('before-input-event', (event, input) => {
            const isToggleCombo =
                (input.key?.toLowerCase?.() === 'i' && (input.control || input.meta) && input.shift) ||
                input.key === 'F12';
            if (isToggleCombo) {
                event.preventDefault();
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.toggleDevTools();
                }
            }
        });
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    mainWindow.on('ready-to-show', () => mainWindow?.show());

    // Save window bounds on move/resize
    const saveBounds = () => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const isMaximized = mainWindow.isMaximized();
        if (!isMaximized) {
            const [x, y] = mainWindow.getPosition();
            const [width, height] = mainWindow.getSize();
            saveAppState({ windowBounds: { x, y, width, height, isMaximized: false } });
        } else {
            saveAppState({
                windowBounds: {
                    ...((mainWindow as any)._lastBounds || { x: 0, y: 0, width: 1200, height: 800 }),
                    isMaximized: true,
                },
            });
        }
    };

    mainWindow.on('resized', saveBounds);
    mainWindow.on('moved', saveBounds);

    mainWindow.on('closed', () => {
        setMainWindow(null);
        setMainWindowRef(null);
        mainWindow = null;
        // Quit the app when the main window is closed
        app.quit();
    });
}

function resolveTheme(theme: AppTheme): AppTheme {
    if (theme === 'system') return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    return theme;
}

app.whenReady().then(async () => {
    await ensureDirectories();

    // Initialize encryption system (handles legacy migration if needed)
    initializeEncryption();

    // First launch: detect OS language, save to settings
    const isFirstLaunch = !(await fileExists(getGeneralSettingsPath()));
    if (isFirstLaunch) {
        const detectedLanguage: AppLanguage = app.getLocale().startsWith('ja') ? 'ja' : 'en';
        await saveGeneralSettings({ language: detectedLanguage, theme: 'system' });
    }

    setupConsoleBridge();
    registerIpcHandlers();

    // App info
    ipcMain.handle(IPC_CHANNELS.APP_GET_INFO, async (): Promise<AppInfo> => {
        const pkg = require('../../package.json');
        const generalSettings = await getGeneralSettings();
        return {
            name: 'Mail Valet',
            version: pkg.version || app.getVersion(),
            language: generalSettings.language,
            theme: resolveTheme(generalSettings.theme),
            os: process.platform as PlatformId,
        };
    });

    ipcMain.handle(IPC_CHANNELS.APP_SET_THEME, async (_e, theme: AppTheme) => {
        nativeTheme.themeSource = theme;
        return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
    });

    ipcMain.handle(IPC_CHANNELS.APP_SET_LANGUAGE, async (_e, lang: AppLanguage) => {
        return { language: lang };
    });

    // Window controls (operate on the calling window, not always mainWindow)
    ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, e => {
        BrowserWindow.fromWebContents(e.sender)?.minimize();
    });
    ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE_OR_RESTORE, e => {
        const win = BrowserWindow.fromWebContents(e.sender);
        if (!win) return false;
        if (win.isMaximized()) {
            win.unmaximize();
            return false;
        }
        win.maximize();
        return true;
    });
    ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, e => {
        return BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false;
    });
    ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, e => {
        BrowserWindow.fromWebContents(e.sender)?.close();
    });

    await createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
