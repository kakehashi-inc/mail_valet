import path from 'path';
import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron';
import { setupConsoleBridge, setMainWindow } from './utils/console-bridge';
import { registerIpcHandlers } from './ipc/index';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
        },
        show: false,
    });

    // コンソールブリッジ用にメインウィンドウを設定
    setMainWindow(mainWindow);

    if (isDev) {
        mainWindow.loadURL('http://localhost:3001');
        // 開発時はDevToolsを自動で開く
        try {
            mainWindow.webContents.openDevTools({ mode: 'detach' });
        } catch {
            // DevToolsのオープンに失敗した場合は無視
        }
        // メニューなしでDevToolsを切り替えるためのキーボードショートカット
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
    mainWindow.on('closed', () => {
        setMainWindow(null);
        mainWindow = null;
    });
}

app.whenReady().then(async () => {
    // コンソールブリッジをセットアップしてメインプロセスのログをDevToolsに送信
    setupConsoleBridge();

    // アプリケーション固有のIPCハンドラを登録
    registerIpcHandlers();

    // アプリ情報取得とウィンドウ制御のIPC
    ipcMain.handle('app:getInfo', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require('../../package.json');
        return {
            name: app.getName() || pkg.name || 'Default App',
            version: pkg.version || app.getVersion(),
            language: (app.getLocale().startsWith('ja') ? 'ja' : 'en') as 'ja' | 'en',
            theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
            os: process.platform as 'win32' | 'darwin' | 'linux',
        };
    });

    ipcMain.handle('app:setTheme', (_e, theme: 'light' | 'dark' | 'system') => {
        nativeTheme.themeSource = theme;
        return { theme };
    });

    ipcMain.handle('app:setLanguage', (_e, lang: 'ja' | 'en') => {
        // 必要に応じて設定に保存
        return { language: lang };
    });

    ipcMain.handle('window:minimize', () => {
        mainWindow?.minimize();
    });
    ipcMain.handle('window:maximizeOrRestore', () => {
        if (!mainWindow) return false;
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
            return false;
        }
        mainWindow.maximize();
        return true;
    });
    ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);
    ipcMain.handle('window:close', () => {
        mainWindow?.close();
    });
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
