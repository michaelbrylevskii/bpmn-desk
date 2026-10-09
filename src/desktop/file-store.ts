import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, unlink, stat, realpath } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import type { OpenedFile, SavedFile } from '../shared/contracts';

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
    const nextToken = token ?? randomUUID();
    this.files.set(nextToken, { path, revision: hash(content) });
    return { token: nextToken, path, name: basename(path) };
  }
}

/** Временный файл находится на той же файловой системе; ошибка не повреждает оригинал. */
export async function atomicWrite(path: string, content: string): Promise<void> {
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
