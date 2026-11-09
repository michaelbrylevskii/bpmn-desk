import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink, stat, realpath } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { FileStatus, OpenedFile, SavedFile } from '../shared/contracts';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const hash = (text: string) => createHash('sha256').update(text).digest('hex');

/** Хранит разрешённые пользователем файлы и обнаруживает внешние изменения. */
export class FileStore {
  private readonly files = new Map<string, { path: string; revision: string }>();

  async open(path: string): Promise<OpenedFile> {
    if (!/\.(bpmn|bpmn20\.xml|xml)$/i.test(path)) throw new Error('Выбери BPMN или XML-файл.');
    const canonical = await realpath(path);
    const info = await stat(canonical);
    if (!info.isFile() || info.size > MAX_FILE_SIZE) throw new Error('Допустим файл размером до 20 МБ.');
    const bytes = await readFile(canonical);
    let xml: string;
    try { xml = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); }
    catch { throw new Error('Файл должен быть в UTF-8. Преобразуй кодировку перед открытием.'); }
    const token = randomUUID();
    this.files.set(token, { path: canonical, revision: hash(xml) });
    return { token, path: canonical, name: basename(canonical), xml };
  }

  pathFor(token: string): string {
    const file = this.files.get(token);
    if (!file) throw new Error('Файл не был открыт в этой сессии. Используй «Сохранить как».');
    return file.path;
  }


  /** Привязка снимка сессии: основа остаётся прежней, диск проверяется отдельно. */
  attach(path: string, originalXml: string): string {
    const token = randomUUID();
    this.files.set(token, { path, revision: hash(originalXml) });
    return token;
  }

  async status(token: string): Promise<FileStatus> {
    const file = this.files.get(token);
    if (!file) return { token, state: 'unavailable', error: 'Файл не был открыт в этой сессии. Используй «Сохранить как».' };
    try {
      const info = await stat(file.path);
      if (!info.isFile() || info.size > MAX_FILE_SIZE) throw new Error('Допустим файл размером до 20 МБ.');
      const revision = hash(await readFile(file.path, 'utf8'));
      return { token, state: revision === file.revision ? 'unchanged' : 'changed', revision };
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return { token, state: 'missing', revision: 'missing' };
      return { token, state: 'unavailable', error: error instanceof Error ? error.message : String(error) };
    }
  }

  async overwrite(content: string, token: string, expected: string): Promise<SavedFile> {
    const status = await this.status(token);
    if (status.state === 'unavailable' || status.revision !== expected) throw new Error('Файл снова изменился. Проверь его состояние и повтори сохранение.');
    if (Buffer.byteLength(content) > MAX_FILE_SIZE) throw new Error('Файл превышает 20 МБ.');
    const path = this.pathFor(token);
    await atomicWrite(path, content);
    const canonical = await realpath(path);
    this.files.set(token, { path: canonical, revision: hash(content) });
    return { token, path: canonical, name: basename(canonical) };
  }

  tokenFor(path: string): string | undefined {
    return [...this.files].reverse().find(([, file]) => file.path === path)?.[0];
  }

  /** «Сохранить как» не меняет основу другой вкладки с тем же файлом. */
  fork(token: string): string {
    this.pathFor(token);
    const copy = randomUUID(); this.files.set(copy, { ...this.files.get(token)! }); return copy;
  }

  async save(content: string, path: string, token?: string): Promise<SavedFile> {
    if (Buffer.byteLength(content) > MAX_FILE_SIZE) throw new Error('Файл превышает 20 МБ.');
    if (token) {
      const file = this.files.get(token);
      if (!file || file.path !== path) throw new Error('Нет разрешения на сохранение этого файла.');
      const current = await readFile(path, 'utf8');
      if (hash(current) !== file.revision) {
        throw new Error('Файл изменён другим приложением. Открой его заново или используй «Сохранить как».');
      }
    }
    await atomicWrite(path, content);
    const canonical = await realpath(path);
    const nextToken = token ?? randomUUID();
    this.files.set(nextToken, { path: canonical, revision: hash(content) });
    return { token: nextToken, path: canonical, name: basename(canonical) };
  }

  async saveExport(content: string | Uint8Array, path: string): Promise<SavedFile> {
    if (Buffer.byteLength(content) > MAX_FILE_SIZE) throw new Error('Файл превышает 20 МБ.');
    await atomicWrite(path, content);
    return { token: '', path, name: basename(path) };
  }
}

/** Временный файл находится на той же файловой системе; ошибка не повреждает оригинал. */
export async function atomicWrite(path: string, content: string | Uint8Array): Promise<void> {
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  let mode = 0o600;
  try { mode = (await stat(path)).mode & 0o777; } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
  try {
    await writeFile(temporary, content, { flag: 'wx', mode, flush: true });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}
