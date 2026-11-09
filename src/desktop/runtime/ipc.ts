import { windowIpc } from '../window-ipc';
import type { WorkspaceChange } from '../../shared/contracts';
import { app, safeStorage, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import { runtimeChannels as channels } from '../../shared/runtime';
import { ConnectionStore } from './connection-store';
import { FlowableReader } from './flowable-reader';
import { RuntimeHttp } from './http';
import { connectionInput, identifier, object, pageQuery } from './validation';
import { historyQuery } from './history-decode';

let shared: { store: ConnectionStore; ready: Promise<void> } | undefined;
function connectionStore() {
  if (shared) return shared;
  const store = new ConnectionStore(app.getPath('userData'), {
    available: () => safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text'),
    encrypt: value => safeStorage.encryptString(value).toString('base64'),
    decrypt: value => safeStorage.decryptString(Buffer.from(value, 'base64')),
  });
  // Повреждённый профиль не перезаписывается. Ошибка показывается при открытии подключений.
  const ready = store.load(); ready.catch(() => undefined);
  shared = { store, ready }; return shared;
}
export function registerRuntimeIpc(window: BrowserWindow, changed: (kind: WorkspaceChange, source: BrowserWindow) => void): void {
  const { store, ready } = connectionStore(); const ipc = windowIpc(window);
  const validate = async (event: IpcMainInvokeEvent) => {
    if (event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('Недопустимый источник IPC.');
    await ready;
  };
  const reader = (value: unknown) => { const { connection, secret } = store.credentials(identifier(value)); return new FlowableReader(new RuntimeHttp(connection, secret)); };
  ipc.handle(channels.connections, async event => { await validate(event); return store.list(); });
  ipc.handle(channels.save, async (event, input: unknown) => { await validate(event); const result = await store.save(connectionInput(input)); changed('connections', window); return result; });
  ipc.handle(channels.delete, async (event, id: unknown) => { await validate(event); const result = await store.delete(identifier(id)); changed('connections', window); return result; });
  ipc.handle(channels.test, async (event, id: unknown) => { await validate(event); return reader(id).test(); });
  ipc.handle(channels.testDraft, async (event, input: unknown) => {
    await validate(event); const value = connectionInput({ ...object(input), name: object(input).name || 'Тест подключения' });
    const { connection, secret } = store.preview(value); return new FlowableReader(new RuntimeHttp(connection, secret)).test();
  });
  ipc.handle(channels.definitions, async (event, id: unknown, query: unknown) => { await validate(event); return reader(id).definitions(pageQuery(query)); });
  ipc.handle(channels.instances, async (event, id: unknown, query: unknown) => { await validate(event); return reader(id).instances(pageQuery(query)); });
  ipc.handle(channels.historicInstances, async (event, id: unknown, query: unknown) => { await validate(event); return reader(id).historicInstances(historyQuery(query)); });
  ipc.handle(channels.history, async (event, id: unknown, instance: unknown) => { await validate(event); return reader(id).history(identifier(instance)); });
  ipc.handle(channels.deadLetters, async (event, id: unknown, query: unknown) => { await validate(event); return reader(id).deadLetters(pageQuery(query)); });
  ipc.handle(channels.diagram, async (event, id: unknown, definition: unknown) => { await validate(event); return reader(id).diagram(identifier(definition)); });
  ipc.handle(channels.instance, async (event, id: unknown, instance: unknown) => { await validate(event); return reader(id).instance(identifier(instance)); });
  ipc.handle(channels.snapshot, async (event, id: unknown, instance: unknown) => { await validate(event); return reader(id).snapshot(identifier(instance)); });
  ipc.handle(channels.summary, async (event, id: unknown, definition: unknown) => { await validate(event); return reader(id).summary(identifier(definition)); });
  ipc.handle(channels.executionVariables, async (event, id: unknown, execution: unknown) => { await validate(event); return reader(id).executionVariables(identifier(execution)); });
  ipc.handle(channels.stacktrace, async (event, id: unknown, job: unknown) => { await validate(event); return reader(id).stacktrace(identifier(job)); });
}
