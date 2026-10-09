import { app, dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { join, basename } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { channels, type SaveRequest } from '../shared/contracts';
import { FileStore } from './file-store';
import { RecentFiles } from './recent-files';

/** Узкий IPC: renderer получает токены документов, не произвольный доступ к fs. */
export async function registerIpc(window: BrowserWindow, setDirty: (value: boolean) => void, initialPaths: string[], closeReady: (dirty: boolean) => void): Promise<(paths: string[]) => Promise<void>> {
  const store = new FileStore();
  const recent = new RecentFiles(app.getPath('userData'));
  await recent.load();
  const examplesDirectory = app.isPackaged ? join(process.resourcesPath, 'examples') : join(app.getAppPath(), 'examples');
  const exampleNames = (await readdir(examplesDirectory)).filter(name => name.endsWith('.bpmn20.xml'));
  const validate = (event: IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('Недопустимый источник IPC.');
    }
  };
  const open = async (path: string) => {
    const file = await store.open(path);
    await recent.add(file.path);
    return file;
  };
  let ready = false;
  const pending = [...initialPaths];
  ipcMain.handle(channels.initial, async event => {
    validate(event); ready = true;
    return Promise.all(pending.splice(0).map(open));
  });
  ipcMain.handle(channels.open, async event => {
    validate(event);
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'BPMN / XML', extensions: ['bpmn', 'xml'] }],
    });
    return Promise.all(result.filePaths.map(open));
  });
  ipcMain.handle(channels.drop, async (event, paths: unknown) => {
    validate(event);
    if (!Array.isArray(paths) || paths.length > 20 || !paths.every(p => typeof p === 'string')) throw new Error('Недопустимый список файлов.');
    return Promise.all(paths.map(open));
  });
  ipcMain.handle(channels.recent, event => { validate(event); return recent.list(); });
  ipcMain.handle(channels.openRecent, (event, path: unknown) => {
    validate(event);
    if (typeof path !== 'string' || !recent.list().includes(path)) throw new Error('Файл отсутствует в недавних.');
    return open(path);
  });
  ipcMain.handle(channels.examples, event => { validate(event); return exampleNames; });
  ipcMain.handle(channels.example, async (event, name: unknown) => {
    validate(event);
    if (typeof name !== 'string' || !exampleNames.includes(name)) throw new Error('Неизвестный пример.');
    return { name, path: '', token: '', xml: await readFile(join(examplesDirectory, name), 'utf8') };
  });
  ipcMain.handle(channels.save, async (event, request: SaveRequest) => {
    validate(event);
    if (!request || typeof request.content !== 'string' || typeof request.name !== 'string' ||
        (request.token !== undefined && typeof request.token !== 'string') ||
        (request.format !== undefined && !['bpmn', 'svg'].includes(request.format))) throw new Error('Недопустимый запрос сохранения.');
    const exportSvg = request.format === 'svg';
    let path: string;
    let token = request.token;
    if (request.saveAs || !token || exportSvg) {
      const result = await dialog.showSaveDialog(window, {
        defaultPath: basename(request.name),
        filters: [{ name: exportSvg ? 'SVG' : 'BPMN', extensions: exportSvg ? ['svg'] : ['bpmn', 'xml'] }],
      });
      if (result.canceled || !result.filePath) return null;
      path = result.filePath;
      token = undefined;
    } else path = store.pathFor(token);
    const saved = await store.save(request.content, path, token);
    if (!exportSvg) await recent.add(path);
    return saved;
  });
  ipcMain.on(channels.dirty, (event, dirty: unknown) => {
    if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && typeof dirty === 'boolean') setDirty(dirty);
  });
  ipcMain.on(channels.closeReady, (event, dirty: unknown) => {
    if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && typeof dirty === 'boolean') closeReady(dirty);
  });
  return async paths => {
    if (!ready) { pending.push(...paths); return; }
    window.webContents.send(channels.opened, await Promise.all(paths.map(open)));
  };
}
