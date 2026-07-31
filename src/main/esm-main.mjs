/**
 * ESM entry point for Electron 43+.
 * The Electron API is accessed through 'electron/main' ESM import.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// CRITICAL: Clear any cached electron module from require cache
// before importing. The npm stub might have been cached.
const Module = require('module');
const electronCacheKey = Object.keys(Module._cache).find(k => k.includes('electron'));
if (electronCacheKey) {
  console.log('[Main] Clearing cached electron module:', electronCacheKey);
  delete Module._cache[electronCacheKey];
}

// Also try to delete from ESM cache if possible
// Now do the static import
const electronModule = await import('electron/main');
console.log('[Main] import keys:', Object.keys(electronModule));
console.log('[Main] import ownProps:', Object.getOwnPropertyNames(electronModule).slice(0, 10));

// Try default export
const electron = electronModule.default;
console.log('[Main] default type:', typeof electron);
if (electron && typeof electron === 'object') {
  console.log('[Main] default keys:', Object.keys(electron));
  console.log('[Main] default ownProps:', Object.getOwnPropertyNames(electron).slice(0, 30));
  console.log('[Main] default prototype:', Object.getOwnPropertyNames(Object.getPrototypeOf(electron)).slice(0, 30));
}

const app = electron?.app || electronModule.app;
const BrowserWindow = electron?.BrowserWindow || electronModule.BrowserWindow;
const ipcMain = electron?.ipcMain || electronModule.ipcMain;
const globalShortcut = electron?.globalShortcut || electronModule.globalShortcut;
const safeStorage = electron?.safeStorage || electronModule.safeStorage;
const dialog = electron?.dialog || electronModule.dialog;

console.log('[Main] app:', typeof app, 'BW:', typeof BrowserWindow, 'process.type:', process.type);

if (!app) {
  console.error('FATAL: Cannot access Electron APIs');
  process.exit(1);
}

globalThis.__electronAPI = { app, BrowserWindow, ipcMain, globalShortcut, safeStorage, dialog };

const { initDatabase } = require('./main/storage/database.js');
const { isEncryptionAvailable } = require('./main/storage/key-store.js');
const { registerAllHandlers } = require('./main/ipc-handlers.js');

let mainWindow = null;
const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    backgroundColor: '#0A0A0A', title: 'Void AI Assistant',
    webPreferences: {
      preload: path.join(__dirname, 'preload/index.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false,
    },
    show: false,
  });
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  registerAllHandlers(mainWindow);
}

function registerShortcuts() {
  globalShortcut.register('CommandOrControl+1', () => mainWindow?.webContents.send('shortcut:mode', 'learning'));
  globalShortcut.register('CommandOrControl+2', () => mainWindow?.webContents.send('shortcut:mode', 'planning'));
  globalShortcut.register('CommandOrControl+3', () => mainWindow?.webContents.send('shortcut:mode', 'focus'));
  globalShortcut.register('CommandOrControl+4', () => mainWindow?.webContents.send('shortcut:mode', 'diary'));
}

app.whenReady().then(() => {
  initDatabase();
  if (!isEncryptionAvailable()) console.warn('[Main] safeStorage encryption unavailable.');
  createWindow();
  registerShortcuts();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => globalShortcut.unregisterAll());
