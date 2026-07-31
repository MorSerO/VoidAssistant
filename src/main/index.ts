import { app, BrowserWindow, globalShortcut } from './electron-access';
import type { BrowserWindow as BrowserWindowType } from 'electron';
import path from 'path';
import { initDatabase } from './storage/database';
import { isEncryptionAvailable } from './storage/key-store';
import { registerAllHandlers } from './ipc-handlers';

let mainWindow: BrowserWindowType | null = null;

// Trust app.isPackaged over NODE_ENV: packaged builds launched outside a
// terminal have no NODE_ENV set, so a NODE_ENV check alone would make the
// packaged app try to load the Vite dev server and show a black window.
const isDev = !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0A0A0A',
    title: 'Void AI Assistant',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  registerAllHandlers(mainWindow);
}

function registerShortcuts(): void {
  globalShortcut.register('CommandOrControl+1', () => {
    mainWindow?.webContents.send('shortcut:mode', 'learning');
  });
  globalShortcut.register('CommandOrControl+2', () => {
    mainWindow?.webContents.send('shortcut:mode', 'planning');
  });
  globalShortcut.register('CommandOrControl+3', () => {
    mainWindow?.webContents.send('shortcut:mode', 'focus');
  });
  globalShortcut.register('CommandOrControl+4', () => {
    mainWindow?.webContents.send('shortcut:mode', 'diary');
  });
}

app.whenReady().then(() => {
  initDatabase();

  if (!isEncryptionAvailable()) {
    console.warn('[Main] safeStorage encryption is NOT available on this system.');
  }

  createWindow();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  globalShortcut.unregisterAll();
});
