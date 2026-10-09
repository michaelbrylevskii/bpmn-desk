import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, type IpcMainInvokeEvent } from 'electron';
import { mkdir } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { channels } from '../shared/contracts';
import { translate, translateText, isLanguage, type MessageKey } from '../shared/i18n';
import { applicationMenu } from './application-menu';
import { interfaceZoomMenu } from './interface-zoom';
import { registerIpc } from './ipc';
import { LanguageSettings } from './language-settings';
protocol.registerSchemesAsPrivileged([{ scheme: 'bpmn-desk', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (process.env.BPMN_DESK_USER_DATA) app.setPath('userData', resolve(process.env.BPMN_DESK_USER_DATA));
const fileArguments = (args: string[]) => args.filter(arg => /\.(bpmn|bpmn20\.xml|xml)$/i.test(arg)).map(arg => arg.startsWith('file://') ? fileURLToPath(arg) : resolve(arg));
let openAdditional: ((paths: string[]) => Promise<void>) | undefined;
let mainWindow: BrowserWindow | undefined;
const language = new LanguageSettings(app.getPath('userData'));
const t = (key: MessageKey) => translate(language.get(), key);
const pending = fileArguments(process.argv.slice(1));
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
else app.on('second-instance', (_event, args) => {
  const paths = fileArguments(args.slice(1));
  if (openAdditional) void openAdditional(paths).catch(error => dialog.showErrorBox(t('Не удалось открыть файл'), translateText(language.get(), String(error))));
  else pending.push(...paths);
  mainWindow?.restore(); mainWindow?.focus();
});

async function start(): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true });
  await language.load();
  const rendererRoot = resolve(import.meta.dirname, '../renderer');
  protocol.handle('bpmn-desk', request => {
    const url = new URL(request.url);
    const path = resolve(rendererRoot, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (url.host !== 'app' || !path.startsWith(`${rendererRoot}${sep}`)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(path).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const window = new BrowserWindow({
    width: 1500, height: 960, minWidth: 1050, minHeight: 680, title: 'BPMN Desk', backgroundColor: '#10131b',
    webPreferences: { preload: join(import.meta.dirname, '../preload/index.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
    icon: app.isPackaged ? join(process.resourcesPath, 'icon.png') : join(app.getAppPath(), 'build/icon.png'),
  });
  mainWindow = window;
  let dirty = false;
  let allowClose = false;
  let pendingClose = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const completeClose = (hasChanges: boolean) => {
    if (!pendingClose) return;
    pendingClose = false;
    if (closeTimer) clearTimeout(closeTimer);
    dirty = hasChanges;
    const choice = !dirty ? 1 : dialog.showMessageBoxSync(window, {
      type: 'question', title: t('Несохранённые изменения'), message: t('Закрыть приложение и оставить изменения для восстановления?'),
      detail: t('Последнее успешно сохранённое состояние доступно для локального восстановления. Чтобы записать изменения в BPMN-файлы, вернись и сохрани документы.'),
      buttons: [t('Вернуться'), t('Закрыть')], defaultId: 0, cancelId: 0,
    });
    if (choice === 1) { allowClose = true; window.close(); }
  };
  window.on('close', event => {
    if (allowClose) return;
    event.preventDefault();
    if (pendingClose) return;
    pendingClose = true;
    window.webContents.send(channels.action, 'prepare-close');
    // При зависшем renderer закрытие также требует явного решения пользователя.
    closeTimer = setTimeout(() => completeClose(true), 1500);
  });
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const zoomMenu = await interfaceZoomMenu(window, () => language.get());
  const changeLanguage = async (value: unknown) => {
    if (!isLanguage(value)) throw new Error(t('Недопустимый язык интерфейса.'));
    await language.set(value);
    installMenu();
    window.webContents.send(channels.languageChanged, value);
  };
  const installMenu = () => applicationMenu(window, language.get(), zoomMenu(), value => {
    void changeLanguage(value).catch(error => { installMenu(); dialog.showErrorBox(t('Не удалось сохранить язык интерфейса.'), String(error)); });
  });
  const validSender = (event: IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error(t('Недопустимый источник IPC.'));
  };
  ipcMain.handle(channels.language, event => { validSender(event); return language.get(); });
  ipcMain.handle(channels.setLanguage, (event, value: unknown) => { validSender(event); return changeLanguage(value); });
  installMenu();
  openAdditional = await registerIpc(window, value => { dirty = value; }, pending, completeClose);
  if (process.env.ELECTRON_RENDERER_URL) await window.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await window.loadURL('bpmn-desk://app/');
}

if (ownsInstance) app.whenReady().then(start).catch(error => { console.error(error); app.quit(); });
app.on('window-all-closed', () => app.quit());
