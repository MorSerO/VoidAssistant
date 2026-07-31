/**
 * Electron API access for CJS modules.
 *
 * Electron 43+ requires ESM imports to access its APIs.
 * The ESM entry point (esm-main.mjs) imports and stores APIs in globalThis.
 * This module provides synchronous access for CJS code.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAPI(): any {
  const api = (globalThis as Record<string, unknown>).__electronAPI;
  if (!api) {
    throw new Error('Electron API not available. Ensure esm-main.mjs is the entry point.');
  }
  return api;
}

export const app: Electron.App = new Proxy({} as unknown as Electron.App, {
  get(_t, p) { return (getAPI().app as Record<string | symbol, unknown>)[p]; }
}) as unknown as Electron.App;

export const BrowserWindow: typeof Electron.BrowserWindow = new Proxy({} as unknown as typeof Electron.BrowserWindow, {
  get(_t, p) { return (getAPI().BrowserWindow as Record<string | symbol, unknown>)[p]; },
  construct(_t, a) { return new (getAPI().BrowserWindow)(...(a as [Electron.BrowserWindowConstructorOptions])); }
}) as unknown as typeof Electron.BrowserWindow;

export const ipcMain: Electron.IpcMain = new Proxy({} as unknown as Electron.IpcMain, {
  get(_t, p) { return (getAPI().ipcMain as Record<string | symbol, unknown>)[p]; }
}) as unknown as Electron.IpcMain;

export const globalShortcut: Electron.GlobalShortcut = new Proxy({} as unknown as Electron.GlobalShortcut, {
  get(_t, p) { return (getAPI().globalShortcut as Record<string | symbol, unknown>)[p]; }
}) as unknown as Electron.GlobalShortcut;

export const safeStorage: Electron.SafeStorage = new Proxy({} as unknown as Electron.SafeStorage, {
  get(_t, p) { return (getAPI().safeStorage as Record<string | symbol, unknown>)[p]; }
}) as unknown as Electron.SafeStorage;

export const dialog: Electron.Dialog = new Proxy({} as unknown as Electron.Dialog, {
  get(_t, p) { return (getAPI().dialog as Record<string | symbol, unknown>)[p]; }
}) as unknown as Electron.Dialog;
