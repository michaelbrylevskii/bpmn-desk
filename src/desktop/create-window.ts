import { app, BrowserWindow, dialog, type IpcMainInvokeEvent } from 'electron';
import { join } from 'node:path';
import { channels } from '../shared/contracts';
import { isLanguage, translate, translateText, type MessageKey } from '../shared/i18n';
import type { MenuState } from '../shared/menu';
import { applicationMenu, updateApplicationMenu } from './application-menu';
import { interfaceZoomMenu } from './interface-zoom';
import { registerIpc, type DocumentServices } from './ipc';
import type { LanguageSettings } from './language-settings';
import { registerRuntimeIpc } from './runtime/ipc';
import { windowIpc } from './window-ipc';

const menus = new Map<number, () => void>();
function updateFocusedMenu(fallback: BrowserWindow): void {
  const window = BrowserWindow.getFocusedWindow() ?? fallback; menus.get(window.id)?.();
}

export async function createWindow({ language, services, paths = [], initialSession = null, focused, newWindow }: {
  language: LanguageSettings; services: DocumentServices; paths?: string[]; initialSession?: string | null;
  focused: (window: BrowserWindow, open: (paths: string[]) => Promise<void>) => void;
  newWindow: () => Promise<void>;
}): Promise<BrowserWindow> {
  const t = (key: MessageKey) => translate(language.get(), key);
  const window = new BrowserWindow({
    width: 1500, height: 960, minWidth: 1050, minHeight: 680, title: 'BPMN Desk', backgroundColor: '#10131b', autoHideMenuBar: true,
    webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    icon: app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(app.getAppPath(), 'build/icon.png'),
  });
  if (initialSession) services.owners.set(initialSession, window);
  const ipc = windowIpc(window);
  let dirty = false; let allowClose = false; let pendingClose = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const completeClose = (hasChanges: boolean, sessionSaved: boolean) => {
    if (!pendingClose) return;
    pendingClose = false; if (closeTimer) clearTimeout(closeTimer);
    dirty = hasChanges;
    const choice = !dirty && sessionSaved ? 1 : dialog.showMessageBoxSync(window, {
      type: sessionSaved ? 'question' : 'warning', title: t('Несохранённые изменения'), message: t(sessionSaved ? 'Закрыть окно и сохранить сессию?' : 'Не удалось сохранить сессию.'),
      detail: t(sessionSaved ? 'Документы останутся в сессии. Изменения в файлы на диске не записываются.' : 'Вернись и сохрани документы в файлы. Последние изменения могут отсутствовать в сессии.'),
      buttons: [t('Вернуться'), t(sessionSaved ? 'Закрыть' : 'Закрыть без сохранения сессии')], defaultId: 0, cancelId: 0,
    });
    if (choice === 1) { allowClose = true; window.close(); }
  };
  window.on('close', event => {
    if (allowClose) return;
    event.preventDefault(); if (pendingClose) return;
    pendingClose = true; window.webContents.send(channels.action, 'prepare-close');
    closeTimer = setTimeout(() => completeClose(true, false), 15000);
  });
  window.once('closed', () => { if (closeTimer) clearTimeout(closeTimer); });
  window.on('app-command', (_event, command) => {
    if (command === 'browser-backward' || command === 'browser-forward') window.webContents.send(channels.action, command);
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const zoomMenu = await interfaceZoomMenu(window, () => language.get());
  const changeLanguage = async (value: unknown) => {
    if (!isLanguage(value)) throw new Error(t('Недопустимый язык интерфейса.'));
    await language.set(value); updateFocusedMenu(window);
    for (const other of BrowserWindow.getAllWindows()) other.webContents.send(channels.languageChanged, value);
  };
  let menuState: MenuState = { document: false, localFile: false, tabs: false, canUndo: false, canRedo: false, canExport: false, monitor: false, back: false, forward: false, canRefresh: false, auto: false, summary: false };
  const installMenu = () => {
    applicationMenu(window, language.get(), zoomMenu(), value => {
      void changeLanguage(value).catch(error => { updateFocusedMenu(window); dialog.showErrorBox(t('Не удалось сохранить язык интерфейса.'), String(error)); });
    }, () => { void newWindow().catch(error => dialog.showErrorBox(t('Не удалось открыть окно.'), String(error))); }); updateApplicationMenu(menuState);
  };
  menus.set(window.id, installMenu); window.once('closed', () => { menus.delete(window.id); });
  const validSender = (event: IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error(t('Недопустимый источник IPC.'));
  };
  ipc.handle(channels.language, event => { validSender(event); return language.get(); });
  ipc.handle(channels.setLanguage, (event, value: unknown) => { validSender(event); return changeLanguage(value); });
  ipc.on(channels.editText, (_event, action: unknown) => {
    if (action === 'cut' || action === 'copy' || action === 'paste' || action === 'selectAll') window.webContents[action]();
  });
  ipc.on(channels.menuState, (_event, state: unknown) => {
    if (!state || typeof state !== 'object' || !Object.keys(menuState).every(key => key in state && typeof Reflect.get(state, key) === 'boolean')) return;
    menuState = state as MenuState; if (window.isFocused()) updateApplicationMenu(menuState);
  });
  installMenu(); registerRuntimeIpc(window, services.changed);
  const open = await registerIpc(window, value => { dirty = value; }, paths, completeClose, value => translateText(language.get(), value), services, initialSession);
  window.on('focus', () => { installMenu(); focused(window, open); });
  focused(window, open);
  if (process.env.ELECTRON_RENDERER_URL) await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await window.loadURL('bpmn-desk://app/');
  return window;
}
