import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStore } from '../../src/desktop/file-store';

describe('FileStore', () => {
  let directory: string;
  let path: string;
  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'bpmn-desk-'));
    path = join(directory, 'process.bpmn');
    await writeFile(path, '<original/>');
  });
  afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

  it('сохраняет открытый файл и обновляет ревизию без временных файлов', async () => {
    const store = new FileStore();
    const file = await store.open(path);
    await store.save('<edited/>', file.path, file.token);
    await store.save('<edited-again/>', file.path, file.token);
    expect(await readFile(path, 'utf8')).toBe('<edited-again/>');
    expect(await readdir(directory)).toEqual(['process.bpmn']);
  });

  it('не затирает внешние изменения', async () => {
    const store = new FileStore();
    const file = await store.open(path);
    await writeFile(path, '<external/>');
    await expect(store.save('<edited/>', file.path, file.token)).rejects.toThrow('изменён другим приложением');
    expect(await readFile(path, 'utf8')).toBe('<external/>');
  });

  it('отклоняет чужой токен', async () => {
    await expect(new FileStore().save('<edited/>', path, 'unknown')).rejects.toThrow('Нет разрешения');
    expect(await readFile(path, 'utf8')).toBe('<original/>');
  });

  it('использует канонический путь capability и не разрешает запись в другой файл', async () => {
    const store = new FileStore();
    const file = await store.open(path);
    expect(store.pathFor(file.token)).toBe(file.path);
    const other = join(directory, 'other.bpmn');
    await writeFile(other, '<other/>');
    await expect(store.save('<edited/>', other, file.token)).rejects.toThrow('Нет разрешения');
    expect(await readFile(other, 'utf8')).toBe('<other/>');
  });

  it('отклоняет неверный UTF-8 и сохраняет файл с BOM без ложного конфликта', async () => {
    const store = new FileStore();
    await writeFile(path, Buffer.from([0xff, 0xfe, 0x00]));
    await expect(store.open(path)).rejects.toThrow('UTF-8');
    await writeFile(path, '\ufeff<original/>');
    const opened = await store.open(path);
    await store.save('<edited/>', opened.path, opened.token);
    expect(await readFile(path, 'utf8')).toBe('<edited/>');
  });

  it('атомарный бинарный экспорт сохраняет байты и не выдаёт capability документа', async () => {
    const store = new FileStore();
    const opened = await store.open(path);
    const image = join(directory, 'diagram.png');
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 128]);
    expect((await store.saveExport(bytes, image)).token).toBe('');
    expect(await readFile(image)).toEqual(Buffer.from(bytes));
    expect(await readdir(directory)).toEqual(['diagram.png', 'process.bpmn']);
    expect(() => store.pathFor('')).toThrow('не был открыт');
    await store.save('<after-export/>', opened.path, opened.token);
    expect(await readFile(path, 'utf8')).toBe('<after-export/>');
  });
});
