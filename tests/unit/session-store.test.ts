import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionStore } from '../../src/desktop/session-store';
import type { WorkspaceSession } from '../../src/shared/sessions';
import { validSession } from '../../src/shared/session-validation';
function session(id: string): WorkspaceSession {
  return { id, updatedAt: new Date().toISOString(), dismissed: false, tabs: [{ kind: 'document', id: 'd' }], activeId: 'd',
    documents: [{ id: 'd', path: '/tmp/process.bpmn', token: 'expired-token', name: 'process.bpmn', xml: '<edited/>', diskXml: '<disk/>', savedXml: '<saved/>', draft: '<unapplied>', view: { x: 3, y: 4, width: 800, height: 600, selected: 'task' } }] };
}
describe('SessionStore', () => {
  let directory: string;
  beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'desk-sessions-')); });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
  it('хранит точный снимок и скрытие предложения между запусками без файловых tokens', async () => {
    const store = new SessionStore(directory); await store.load(); await store.put(session('one')); await store.dismiss('one');
    const reopened = new SessionStore(directory); await reopened.load();
    expect(reopened.list()[0]!.dismissed).toBe(true);
    expect((await reopened.read('one')).documents[0]).toEqual({ ...session('one').documents[0], token: undefined });
    expect(reopened.list()[0]!.tabs[0]!.dirty).toBe(true);
    await reopened.put({ ...await reopened.read('one'), dismissed: false });
    expect(reopened.list()[0]!.dismissed).toBe(false);
  });
  it('оставляет 15 последних сессий, включая удаление несохранённых снимков', async () => {
    const store = new SessionStore(directory); await store.load();
    for (let index = 0; index < 17; index++) await store.put(session(`session-${index}`));
    expect(store.list()).toHaveLength(15);
    expect(store.list()[0]!.id).toBe('session-16');
    await expect(readFile(join(directory, 'sessions/session-0.json'))).rejects.toThrow();
    await store.remove('session-16'); await expect(store.read('session-16')).rejects.toThrow();
  });
  it('не создаёт пустые сессии и удаляет текущее состояние после закрытия всех вкладок', async () => {
    const store = new SessionStore(directory); await store.load(); await store.put(session('one'));
    await store.put({ ...session('one'), documents: [], tabs: [{ kind: 'home', id: 'home' }] });
    expect(store.list()).toEqual([]);
  });
  it('проверяет ссылки вкладок, XML, viewport и пути идентификаторов', () => {
    expect(validSession(session('one'))).toBe(true);
    expect(validSession({ ...session('../outside') })).toBe(false);
    expect(validSession({ ...session('one'), documents: [] })).toBe(false);
    expect(validSession({ ...session('one'), documents: [{ ...session('one').documents[0], view: { x: 0, y: 0, width: 0, height: 0 } }] })).toBe(false);
  });
  it('ошибка чтения снимков не разрешает перезаписать сохранённые данные', async () => {
    const store = new SessionStore(directory); await store.load(); await store.put(session('one'));
    const path = join(directory, 'sessions/index.json'); await writeFile(path, '{broken');
    const reopened = new SessionStore(directory); await reopened.load();
    expect(() => reopened.list()).toThrow('Не удалось прочитать');
    expect(() => reopened.put(session('two'))).toThrow('Не удалось прочитать');
    expect(await readFile(path, 'utf8')).toBe('{broken');
  });

});
