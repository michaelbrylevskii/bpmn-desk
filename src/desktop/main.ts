import { app, BrowserWindow, dialog, net, protocol, session } from 'electron';
import { mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { channels } from '../shared/contracts';
import { translate, translateText } from '../shared/i18n';
import { LanguageSettings } from './language-settings';
import { RecentFiles } from './recent-files';
import { SessionStore } from './session-store';
import { createWindow } from './create-window';
import type { DocumentServices } from './ipc';
import { UpdateChecker } from './updates/checker';
protocol.registerSchemesAsPrivileged([{ scheme: 'bpmn-desk', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
if (process.env.BPMN_DESK_USER_DATA) app.setPath('userData', resolve(process.env.BPMN_DESK_USER_DATA));
const fileArguments = (args: string[]) => args.filter(arg => /\.(bpmn|bpmn20\.xml|xml)$/i.test(arg)).map(arg => arg.startsWith('file://') ? fileURLToPath(arg) : resolve(arg));
let openAdditional: ((paths: string[]) => Promise<void>) | undefined;
let openEmptyWindow: (() => Promise<void>) | undefined;
let pendingWindows = 0;
let mainWindow: BrowserWindow | undefined;
const language = new LanguageSettings(app.getPath('userData'));
const pending = fileArguments(process.argv.slice(1));
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
else app.on('second-instance', (_event, args) => {
  const paths = fileArguments(args.slice(1));
  if (!paths.length) {
    if (openEmptyWindow) void openEmptyWindow().catch(error => dialog.showErrorBox(translate(language.get(), 'Не удалось открыть окно.'), translateText(language.get(), String(error))));
    else pendingWindows++;
    return;
  }
  if (openAdditional) void openAdditional(paths).catch(error => dialog.showErrorBox(translate(language.get(), 'Не удалось открыть файл'), translateText(language.get(), String(error))));
  else pending.push(...paths);
  mainWindow?.restore(); mainWindow?.focus();
});
async function start(): Promise<void> {
  await mkdir(app.getPath('userData'), { recursive: true }); await language.load();
  const rendererRoot = resolve(import.meta.dirname, '../renderer');
  protocol.handle('bpmn-desk', request => {
    const url = new URL(request.url);
    const path = resolve(rendererRoot, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
    if (url.host !== 'app' || !path.startsWith(`${rendererRoot}${sep}`)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(path).toString());
  });
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const versionOverride = process.env.VITE_BPMN_DESK_DEV_VERSION;
  const developmentVersion = !app.isPackaged && versionOverride && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(versionOverride) ? versionOverride : undefined;
  const updates = new UpdateChecker(developmentVersion ?? app.getVersion(), (url, options) => net.fetch(url, options));
  app.once('will-quit', () => updates.stop());
  const sessions = new SessionStore(app.getPath('userData')); const recent = new RecentFiles(app.getPath('userData'));
  await sessions.load(); await recent.load();
  const services: DocumentServices = { sessions, recent, owners: new Map(),
    openSession: async id => { await openWindow([], id); },
    changed: (kind, source) => { for (const window of BrowserWindow.getAllWindows()) if (window !== source) window.webContents.send(channels.workspaceChanged, kind); },
  };
  const openers = new Map<number, (paths: string[]) => Promise<void>>();
  const openWindow = (paths: string[], initialSession?: string): Promise<BrowserWindow> => createWindow({ language, services, updates, paths, initialSession,
    newWindow: async () => { await openWindow([]); },
    focused: (window, open) => {
      if (!openers.has(window.id)) {
        openers.set(window.id, open); window.once('closed', () => {
          openers.delete(window.id); if (mainWindow === window) { mainWindow = BrowserWindow.getAllWindows().at(-1); openAdditional = mainWindow ? openers.get(mainWindow.id) : undefined; }
        });
      }
      mainWindow = window; openAdditional = open; if (pending.length) void open(pending.splice(0)).catch(console.error); },
  });
  openEmptyWindow = async () => { await openWindow([]); };
  await openWindow(pending.splice(0));
  // В разработке публичная проверка включается только явной подменой версии.
  if (app.isPackaged || developmentVersion) updates.start();
  while (pendingWindows > 0) { pendingWindows--; await openEmptyWindow(); }
}
if (ownsInstance) app.whenReady().then(start).catch(error => { console.error(error); app.quit(); });
app.on('window-all-closed', () => app.quit());
