import { ipcMain, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
type Handler = (event: IpcMainInvokeEvent, args: unknown[]) => unknown;
const cleanup = new WeakMap<BrowserWindow, (() => void)[]>();
function closed(window: BrowserWindow, callback: () => void): void {
  let entries = cleanup.get(window);
  if (!entries) { entries = []; cleanup.set(window, entries); window.once('closed', () => { for (const dispose of cleanup.get(window) ?? []) dispose(); cleanup.delete(window); }); }
  entries.push(callback);
}
const handlers = new Map<string, Map<number, Handler>>();
/** Один IPC channel обслуживает только callback окна-отправителя. */
export function windowIpc(window: BrowserWindow) {
  const sender = window.webContents.id;
  return {
    handle<T extends unknown[]>(channel: string, callback: (event: IpcMainInvokeEvent, ...args: T) => unknown): void {
      let entries = handlers.get(channel);
      if (!entries) {
        entries = new Map(); handlers.set(channel, entries);
        ipcMain.handle(channel, (event, ...args: unknown[]) => {
          const handler = handlers.get(channel)?.get(event.sender.id);
          if (!handler || event.senderFrame !== event.sender.mainFrame) throw new Error('Недопустимый источник IPC.');
          return handler(event, args);
        });
      }
      entries.set(sender, (event, args) => callback(event, ...args as T));
      closed(window, () => handlers.get(channel)?.delete(sender));
    },
    on<T extends unknown[]>(channel: string, callback: (event: IpcMainEvent, ...args: T) => void): void {
      const listener = (event: IpcMainEvent, ...args: unknown[]) => { if (event.sender.id === sender && event.senderFrame === event.sender.mainFrame) callback(event, ...args as T); };
      ipcMain.on(channel, listener); closed(window, () => { ipcMain.removeListener(channel, listener); });
    },
  };
}
