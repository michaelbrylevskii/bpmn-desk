import { windowIpc } from './window-ipc';
import { SessionStore } from './session-store';
import { validSession } from '../shared/session-validation';
import { app, dialog, shell, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { join, basename, dirname, resolve } from 'node:path';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { channels, type SaveRequest, type WorkspaceChange } from '../shared/contracts';
import { FileStore } from './file-store';
import { RecentFiles } from './recent-files';

export interface DocumentServices {
  sessions: SessionStore; recent: RecentFiles; owners: Map<string, BrowserWindow>;
  openSession: (id: string) => Promise<void>; changed: (kind: WorkspaceChange, source: BrowserWindow) => void;
}

/** Узкий IPC: renderer получает токены документов, не произвольный доступ к fs. */
export async function registerIpc(window: BrowserWindow, setDirty: (value: boolean) => void, initialPaths: string[], closeReady: (dirty: boolean, sessionSaved: boolean) => void, text: (value: string) => string, services: DocumentServices, initialSession: string | null = null): Promise<(paths: string[]) => Promise<void>> {
  const store = new FileStore();
  const { sessions, recent, owners } = services; const ipc = windowIpc(window);
  const changed = (kind: WorkspaceChange) => services.changed(kind, window);
  const examplesDirectory = app.isPackaged ? join(process.resourcesPath, 'examples') : join(app.getAppPath(), 'examples');
  const exampleNames = (await readdir(examplesDirectory)).filter(name => name.endsWith('.bpmn20.xml'));
  const validate = (event: IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) {
      throw new Error('Недопустимый источник IPC.');
    }
  };
  ipc.handle(channels.initialSession, event => { validate(event); const id = initialSession; initialSession = null; return id; });
  ipc.handle(channels.sessions, event => { validate(event); return sessions.list().map(item => ({ ...item, open: !!owners.get(item.id) && owners.get(item.id) !== window })); });
  ipc.handle(channels.saveSession, async (event, value: unknown) => {
    validate(event); if (!validSession(value)) throw new Error('Недопустимая сессия.');
    for (const document of value.documents) if (document.path && (!document.token || store.pathFor(document.token) !== document.path)) throw new Error('Нет разрешения на сохранение этого файла.');
    const owner = owners.get(value.id);
    if (owner && owner !== window) throw new Error('Сессия уже открыта в другом окне.');
    await sessions.put(value);
    for (const [id, owner] of owners) if (owner === window) owners.delete(id);
    if (value.tabs.some(tab => tab.kind !== 'home')) owners.set(value.id, window);
    changed('sessions');
  });
  ipc.handle(channels.restoreSession, async (event, id: unknown, newWindow: unknown = false) => {
    validate(event); if (typeof id !== 'string' || !sessions.list().some(entry => entry.id === id)) throw new Error('Недопустимая сессия.');
    if (typeof newWindow !== 'boolean') throw new Error('Недопустимая сессия.');
    const owner = owners.get(id);
    if (owner && owner !== window && !owner.isDestroyed()) { owner.restore(); owner.show(); owner.focus(); return null; }
    if (newWindow) { await services.openSession(id); return null; }
    owners.set(id, window);
    const session = await sessions.read(id);
    return { ...session, dismissed: false, documents: session.documents.map(document => ({ ...document, token: document.path ? store.attach(document.path, document.diskXml) : undefined })) };
  });
  ipc.handle(channels.dismissSession, async (event, id: unknown) => {
    validate(event); if (typeof id !== 'string' || !sessions.list().some(entry => entry.id === id)) throw new Error('Недопустимая сессия.');
    await sessions.dismiss(id); changed('sessions');
  });
  ipc.handle(channels.deleteSession, async (event, id: unknown) => {
    validate(event); if (typeof id !== 'string' || !sessions.list().some(entry => entry.id === id)) throw new Error('Недопустимая сессия.');
    if (owners.has(id)) throw new Error('Сессия открыта в другом окне. Закрой её перед удалением.');
    await sessions.remove(id); changed('sessions');
  });
  const open = async (path: string) => {
    const file = await store.open(path);
    await recent.add(file.path); changed('recent');
    return file;
  };
  let ready = false;
  const pending = [...initialPaths];
  ipc.handle(channels.initial, async event => {
    validate(event); ready = true;
    return Promise.all(pending.splice(0).map(open));
  });
  ipc.handle(channels.open, async event => {
    validate(event);
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'BPMN / XML', extensions: ['bpmn', 'xml'] }],
    });
    return Promise.all(result.filePaths.map(open));
  });
  ipc.handle(channels.drop, async (event, paths: unknown) => {
    validate(event);
    if (!Array.isArray(paths) || paths.length > 20 || !paths.every(p => typeof p === 'string')) throw new Error('Недопустимый список файлов.');
    return Promise.all(paths.map(open));
  });
  ipc.handle(channels.removeRecent, async (event, path: unknown) => {
    validate(event);
    if (typeof path !== 'string') throw new Error('Недопустимый список файлов.');
    await recent.remove(path); changed('recent'); return recent.list();
  });
  ipc.handle(channels.statuses, (event, tokens: unknown) => {
    validate(event);
    if (!Array.isArray(tokens) || !tokens.every((token): token is string => typeof token === 'string')) throw new Error('Недопустимый список файлов.');
    return Promise.all(tokens.map(token => store.status(token)));
  });
  ipc.handle(channels.reload, (event, token: unknown) => {
    validate(event); if (typeof token !== 'string') throw new Error('Нет разрешения на сохранение этого файла.');
    return store.open(store.pathFor(token));
  });
  ipc.handle(channels.reveal, async (event, token: unknown) => {
    validate(event); if (typeof token !== 'string') throw new Error('Нет разрешения на сохранение этого файла.');
    const path = store.pathFor(token);
    if ((await store.status(token)).state === 'missing') { const error = await shell.openPath(dirname(path)); if (error) throw new Error(error); }
    else shell.showItemInFolder(path);
  });
  ipc.handle(channels.recent, event => { validate(event); return recent.list(); });
  ipc.handle(channels.openRecent, (event, path: unknown) => {
    validate(event);
    if (typeof path !== 'string' || !recent.list().includes(path)) throw new Error('Файл отсутствует в недавних.');
    return open(path);
  });
  ipc.handle(channels.examples, event => { validate(event); return exampleNames; });
  ipc.handle(channels.example, async (event, name: unknown) => {
    validate(event);
    if (typeof name !== 'string' || !exampleNames.includes(name)) throw new Error('Неизвестный пример.');
    return { name, path: '', token: '', xml: await readFile(join(examplesDirectory, name), 'utf8') };
  });
  ipc.handle(channels.save, async (event, request: SaveRequest) => {
    validate(event);
    const png = request?.format === 'png';
    const binary = png && request.content instanceof Uint8Array && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => request.content[index] === byte);
    if (!request || (png ? !binary : typeof request.content !== 'string') || typeof request.name !== 'string' ||
        (request.token !== undefined && typeof request.token !== 'string') ||
        (request.saveAs !== undefined && typeof request.saveAs !== 'boolean') ||
        (request.format !== undefined && !['bpmn', 'svg', 'png'].includes(request.format))) throw new Error('Недопустимый запрос сохранения.');
    const exporting = request.format === 'svg' || png;
    let path: string;
    let token = request.token;
    if (request.saveAs || !token || exporting) {
      const result = await dialog.showSaveDialog(window, {
        defaultPath: basename(request.name),
        filters: [{ name: exporting ? png ? 'PNG' : 'SVG' : 'BPMN', extensions: exporting ? png ? ['png'] : ['svg'] : ['bpmn', 'xml'] }],
      });
      if (result.canceled || !result.filePath) return null;
      path = result.filePath;
      token = undefined;
    } else path = store.pathFor(token);
    if (!exporting && !token) {
      const canonical = await realpath(path).catch(error => { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return resolve(path); throw error; });
      token = store.tokenFor(canonical); if (token) { token = store.fork(token); path = canonical; }
    }
    if (!exporting && token) {
      const status = await store.status(token);
      if (status.state !== 'unchanged') {
        const missing = status.state === 'missing'; const unavailable = status.state === 'unavailable';
        const choice = await dialog.showMessageBox(window, {
          type: 'warning', title: text('Состояние файла'),
          message: text(missing ? 'Файл удалён с диска.' : unavailable ? 'Не удалось проверить файл на диске.' : 'Файл изменён другим приложением.'),
          detail: path + (status.error ? `\n${status.error}` : ''),
          buttons: [text('Отмена'), text('Сохранить как…'), ...unavailable ? [] : [text(missing ? 'Создать файл заново' : 'Перезаписать файл')]], defaultId: 0, cancelId: 0,
        });
        if (choice.response === 0) return null;
        if (choice.response === 1) {
          const destination = await dialog.showSaveDialog(window, { defaultPath: basename(request.name), filters: [{ name: 'BPMN', extensions: ['bpmn', 'xml'] }] });
          if (destination.canceled || !destination.filePath) return null;
          if (await realpath(destination.filePath).catch(() => resolve(destination.filePath!)) === resolve(path)) throw new Error('Для копии выбери другой файл.');
          const saved = await store.save(request.content as string, destination.filePath);
          await recent.add(saved.path); changed('recent'); return saved;
        }
        const saved = await store.overwrite(request.content as string, token, status.revision ?? '');
        await recent.add(saved.path); changed('recent'); return saved;
      }
    }
    const saved = request.format === 'png' || request.format === 'svg' ? await store.saveExport(request.content, path) : await store.save(request.content, path, token);
    if (!exporting) { await recent.add(saved.path); changed('recent'); }
    return saved;
  });
  ipc.on(channels.dirty, (event, dirty: unknown) => {
    if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && typeof dirty === 'boolean') setDirty(dirty);
  });
  ipc.on(channels.closeReady, (event, dirty: unknown, sessionSaved: unknown = true) => {
    if (event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && typeof dirty === 'boolean' && typeof sessionSaved === 'boolean') closeReady(dirty, sessionSaved);
  });
  window.once('closed', () => { for (const [id, owner] of owners) if (owner === window) owners.delete(id); changed('sessions'); });
  return async paths => {
    if (!ready) { pending.push(...paths); return; }
    window.webContents.send(channels.opened, await Promise.all(paths.map(open)));
  };
}
