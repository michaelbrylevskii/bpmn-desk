import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicWrite } from '../file-store';
import type { Connection, ConnectionInput, Connections } from '../../shared/runtime';
import { connectionInput, identifier, object } from './validation';

export interface SecretStorage { available(): boolean; encrypt(value: string): string; decrypt(value: string): string }
interface StoredConnection { profile: Connection; encrypted?: string }
export class ConnectionStore {
  private items: StoredConnection[] = [];
  private readonly sessionSecrets = new Map<string, string>();
  private writes = Promise.resolve();
  constructor(private readonly directory: string, private readonly secrets: SecretStorage) {}
  async load(): Promise<void> {
    let source: string;
    try { source = await readFile(join(this.directory, 'connections.json'), 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    const data = object(JSON.parse(source));
    if (data.version !== 1 || !Array.isArray(data.items) || data.items.length > 100) throw new Error('Не удалось прочитать список подключений.');
    this.items = data.items.map(value => {
      const item = object(value); const raw = object(item.profile);
      const input = connectionInput({ ...raw, rememberSecret: false });
      const id = identifier(raw.id);
      if (item.encrypted !== undefined && (typeof item.encrypted !== 'string' || item.encrypted.length > 50000)) throw new Error('Не удалось прочитать секрет подключения.');
      return { profile: { id, name: input.name, engine: input.engine, baseUrl: input.baseUrl, authentication: input.authentication,
        username: input.username, hasSecret: false, secretStored: !!item.encrypted }, encrypted: item.encrypted as string | undefined };
    });
    if (new Set(this.items.map(item => item.profile.id)).size !== this.items.length) throw new Error('Повторяющиеся идентификаторы подключений.');
  }
  list(): Connections {
    return { secureStorage: this.secrets.available(), items: this.items.map(({ profile, encrypted }) => ({ ...profile,
      hasSecret: this.sessionSecrets.has(profile.id) || !!encrypted && this.secrets.available(), secretStored: !!encrypted })) };
  }
  credentials(id: string): { connection: Connection; secret: string } {
    const item = this.items.find(item => item.profile.id === identifier(id));
    if (!item) throw new Error('Подключение не найдено.');
    let secret = this.sessionSecrets.get(id) ?? '';
    if (!secret && item.encrypted) {
      if (!this.secrets.available()) throw new Error('Хранилище секретов ОС недоступно. Введи пароль или токен для этой сессии.');
      try { secret = this.secrets.decrypt(item.encrypted); } catch { throw new Error('Не удалось расшифровать секрет. Введи пароль или токен заново.'); }
    }
    if (item.profile.authentication !== 'none' && !secret) throw new Error('Введи пароль или токен подключения.');
    return { connection: item.profile, secret };
  }
  preview(value: ConnectionInput): { connection: Connection; secret: string } {
    const input = connectionInput({ ...value, name: value.name || 'Тест подключения' });
    const existing = this.items.find(item => item.profile.id === input.id)?.profile;
    const sameAuth = existing?.baseUrl === input.baseUrl && existing.authentication === input.authentication && existing.username === input.username;
    const secret = input.secret ?? (sameAuth ? this.credentials(existing!.id).secret : '');
    if (input.authentication !== 'none' && !secret) throw new Error('Введи пароль или токен подключения.');
    return { connection: { id: input.id ?? '', name: input.name, engine: input.engine, baseUrl: input.baseUrl, authentication: input.authentication,
      username: input.username, hasSecret: !!secret, secretStored: false }, secret };
  }
  save(value: ConnectionInput): Promise<Connection> {
    return this.mutate(async () => {
      const input = connectionInput(value); const id = input.id ?? randomUUID();
      const previous = this.items.find(item => item.profile.id === id);
      if (input.id && !previous) throw new Error('Подключение не найдено.');
      if (!previous && this.items.length >= 100) throw new Error('Достигнут предел подключений: 100.');
      const sameAuth = previous?.profile.authentication === input.authentication && previous.profile.username === input.username && previous.profile.baseUrl === input.baseUrl;
      let secret = input.secret;
      if (secret === undefined && sameAuth) secret = this.sessionSecrets.get(id);
      let encrypted = secret === undefined && sameAuth ? previous?.encrypted : undefined;
      if (input.authentication === 'none') { secret = undefined; encrypted = undefined; }
      else if (input.rememberSecret) {
        if (!this.secrets.available()) throw new Error('Хранилище секретов ОС недоступно. Сохрани подключение без запоминания пароля.');
        if (secret) encrypted = this.secrets.encrypt(secret);
      } else {
        if (secret === undefined && encrypted) {
          if (!this.secrets.available()) throw new Error('Введи пароль или токен заново.');
          secret = this.secrets.decrypt(encrypted);
        }
        encrypted = undefined;
      }
      const profile: Connection = { id, name: input.name, engine: input.engine, baseUrl: input.baseUrl, authentication: input.authentication,
        username: input.username, hasSecret: false, secretStored: !!encrypted };
      const items = this.items.filter(item => item.profile.id !== id).concat({ profile, encrypted });
      await this.persist(items); this.items = items;
      this.sessionSecrets.delete(id); if (secret) this.sessionSecrets.set(id, secret);
      return this.list().items.find(item => item.id === id)!;
    });
  }
  delete(id: string): Promise<void> {
    return this.mutate(async () => {
      identifier(id); const items = this.items.filter(item => item.profile.id !== id);
      await this.persist(items); this.items = items; this.sessionSecrets.delete(id);
    });
  }
  private persist(items: StoredConnection[]): Promise<void> {
    return atomicWrite(join(this.directory, 'connections.json'), JSON.stringify({ version: 1, items }));
  }
  private mutate<T>(action: () => Promise<T>): Promise<T> {
    const pending = this.writes.catch(() => undefined).then(action);
    this.writes = pending.then(() => undefined, () => undefined); return pending;
  }
}
