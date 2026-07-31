/**
 * Electron API access for CJS modules.
 *
 * Direct re-exports from the electron package.
 * Electron 26 supports CommonJS require('electron') natively.
 */
export { app, BrowserWindow, ipcMain, globalShortcut, safeStorage, dialog } from 'electron';
