import { mkdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from './file-store';
import { retainSessions, type SessionOverview, type WorkspaceSession } from '../shared/sessions';
import { sessionOverview, validSession } from '../shared/session-validation';

/** Каждый снимок записывается отдельно, чтобы не переписывать XML остальных сессий. */
export class SessionStore {
  private failed = false;
  private entries: SessionOverview[] = [];
  private pending: Promise<unknown> = Promise.resolve();
  private readonly directory: string;
  constructor(directory: string) { this.directory = join(directory, 'sessions'); }
  private path(id: string): string {
    if (!/^[\w-]{1,80}$/.test(id)) throw new Error('Недопустимая сессия.');
    return join(this.directory, `${id}.json`);
  }
  async load(): Promise<void> {
    await mkdir(this.directory, { recursive: true });
    let ids: unknown;
    try { ids = JSON.parse(await readFile(join(this.directory, 'index.json'), 'utf8')); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) this.failed = true; return; }
    if (!Array.isArray(ids) || !ids.every((id): id is string => typeof id === 'string' && /^[\w-]{1,80}$/.test(id))) { this.failed = true; return; }
    this.entries = [];
    try { for (const id of ids) this.entries.push(sessionOverview(await this.read(id))); } catch { this.failed = true; }
  }
  private check(): void { if (this.failed) throw new Error('Не удалось прочитать сессии. Сохранённые данные не изменены.'); }
  list(): SessionOverview[] { this.check(); return structuredClone(this.entries); }
  async read(id: string): Promise<WorkspaceSession> {
    const record: unknown = JSON.parse(await readFile(this.path(id), 'utf8'));
    if (!validSession(record) || record.id !== id) throw new Error('Недопустимая сессия.');
    return record;
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    this.check();
    const result = this.pending.catch(() => undefined).then(operation); this.pending = result; return result;
  }
  private index(): Promise<void> { return atomicWrite(join(this.directory, 'index.json'), JSON.stringify(this.entries.map(entry => entry.id))); }
  put(session: WorkspaceSession): Promise<void> {
    return this.enqueue(async () => {
      if (!validSession(session)) throw new Error('Недопустимая сессия.');
      const existing = this.entries.find(entry => entry.id === session.id);
      if (!session.tabs.some(tab => tab.kind !== 'home') && !existing?.pinned) { await this.removeNow(session.id); return; }
      const safe = { ...session, ...existing ? { name: existing.name, pinned: existing.pinned } : {}, documents: session.documents.map(document => { const copy = { ...document }; delete copy.token; return copy; }) };
      await this.store(safe);
    });
  }
  private async store(session: WorkspaceSession): Promise<void> {
    await atomicWrite(this.path(session.id), JSON.stringify(session));
    const all = [sessionOverview(session), ...this.entries.filter(entry => entry.id !== session.id)];
    this.entries = retainSessions(all); await this.index();
    for (const entry of all.filter(entry => !this.entries.some(kept => kept.id === entry.id))) await unlink(this.path(entry.id)).catch(() => undefined);
  }
  setPin(id: string, name: string | null): Promise<void> {
    return this.enqueue(async () => {
      if (name !== null && (!name.trim() || name.trim().length > 80)) throw new Error('Укажи имя сессии длиной от 1 до 80 символов.');
      const session = await this.read(id);
      await this.store({ ...session, name: name === null ? session.name : name.trim(), pinned: name !== null });
    });
  }
  dismiss(id: string): Promise<void> {
    return this.enqueue(async () => {
      const session = await this.read(id); session.dismissed = true;
      await atomicWrite(this.path(id), JSON.stringify(session));
      this.entries = this.entries.map(entry => entry.id === id ? { ...entry, dismissed: true } : entry);
    });
  }
  remove(id: string): Promise<void> { return this.enqueue(() => this.removeNow(id)); }
  private async removeNow(id: string): Promise<void> {
    this.entries = this.entries.filter(entry => entry.id !== id); await this.index();
    await unlink(this.path(id)).catch(error => { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; });
  }
}
