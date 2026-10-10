import { app, ipcMain, safeStorage, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { runtimeChannels as channels } from '../../shared/runtime';
import { ConnectionStore } from './connection-store';
import { FlowableReader } from './flowable-reader';
import { RuntimeHttp } from './http';
import { connectionInput, identifier, object, pageQuery } from './validation';

export function registerRuntimeIpc(window: BrowserWindow): void {
  const store = new ConnectionStore(app.getPath('userData'), {
    available: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
    encrypt: value => safeStorage.encryptString(value).toString('base64'),
    decrypt: value => safeStorage.decryptString(Buffer.from(value, 'base64')),
  });
  // Повреждённый профиль не перезаписывается. Ошибка показывается при открытии подключений.
  const ready = store.load(); ready.catch(() => undefined);
  const validate = async (event: IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый источник IPC.');
    await ready;
  };
  const reader = (value: unknown) => { const { connection, secret } = store.credentials(identifier(value)); return new FlowableReader(new RuntimeHttp(connection, secret)); };
  ipcMain.handle(channels.connections, async event => { await validate(event); return store.list(); });
  ipcMain.handle(channels.save, async (event, input: unknown) => { await validate(event); return store.save(connectionInput(input)); });
  ipcMain.handle(channels.delete, async (event, id: unknown) => { await validate(event); return store.delete(identifier(id)); });
  ipcMain.handle(channels.test, async (event, id: unknown) => { await validate(event); return reader(id).test(); });
  ipcMain.handle(channels.testDraft, async (event, input: unknown) => {
    await validate(event); const value = connectionInput({ ...object(input), name: object(input).name || 'Тест подключения' });
    const { connection, secret } = store.preview(value); return new FlowableReader(new RuntimeHttp(connection, secret)).test();
  });
  ipcMain.handle(channels.definitions, async (event, id: unknown, query: unknown) => { await validate(event); return reader(id).definitions(pageQuery(query)); });
  ipcMain.handle(channels.instances, async (event, id: unknown, query: unknown) => { await validate(event); return reader(id).instances(pageQuery(query)); });
  ipcMain.handle(channels.deadLetters, async (event, id: unknown, query: unknown) => { await validate(event); return reader(id).deadLetters(pageQuery(query)); });
  ipcMain.handle(channels.diagram, async (event, id: unknown, definition: unknown) => { await validate(event); return reader(id).diagram(identifier(definition)); });
  ipcMain.handle(channels.snapshot, async (event, id: unknown, instance: unknown) => { await validate(event); return reader(id).snapshot(identifier(instance)); });
  ipcMain.handle(channels.executionVariables, async (event, id: unknown, execution: unknown) => { await validate(event); return reader(id).executionVariables(identifier(execution)); });
  ipcMain.handle(channels.stacktrace, async (event, id: unknown, job: unknown) => { await validate(event); return reader(id).stacktrace(identifier(job)); });
}
