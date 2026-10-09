import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

/** Внешний пакет — только тестовые входы. Никакие файлы пакета не изменяются. */
export function loadSchemaPack(directory) {
  if (!directory) throw new Error('Укажи каталог пакета в BPMN_DESK_EXTRA_SCHEMAS.');
  const pack = realpathSync(resolve(directory));
  const schemas = realpathSync(resolve(pack, 'schemas'));
  if (relative(pack, schemas).startsWith('..')) throw new Error('Каталог schemas должен находиться внутри пакета.');
  const records = JSON.parse(readFileSync(resolve(pack, 'provenance.json'), 'utf8'));
  if (!Array.isArray(records) || records.length === 0) throw new Error('provenance.json должен содержать непустой массив схем.');
  const names = new Set();
  const result = records.map(record => {
    if (!record || typeof record.file !== 'string' || /[\\/\0]/.test(record.file) ||
        basename(record.file) !== record.file || !/\.(bpmn|xml)$/i.test(record.file) ||
        typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(record.sha256)) {
      throw new Error('Каждая запись provenance требует безопасное имя .bpmn/.xml и sha256.');
    }
    const key = record.file.toLowerCase();
    if (names.has(key)) throw new Error(`Повтор схемы в provenance: ${record.file}`);
    names.add(key);
    const path = realpathSync(resolve(schemas, record.file));
    if (!path.startsWith(`${schemas}${sep}`) || !statSync(path).isFile()) throw new Error('Схема должна быть файлом внутри schemas.');
    const data = readFileSync(path);
    try { new TextDecoder('utf-8', { fatal: true }).decode(data); }
    catch { throw new Error(`Схема должна иметь кодировку UTF-8: ${record.file}`); }
    const sha256 = createHash('sha256').update(data).digest('hex');
    if (sha256 !== record.sha256.toLowerCase()) throw new Error(`SHA-256 не совпадает: ${record.file}`);
    return { file: record.file, path, sha256 };
  });
  const files = readdirSync(schemas).filter(file => /\.(bpmn|xml)$/i.test(file));
  if (files.length !== result.length || files.some(file => !names.has(file.toLowerCase()))) {
    throw new Error('Каждая BPMN/XML-схема пакета должна быть перечислена в provenance.json.');
  }
  return { directory: pack, schemasDirectory: schemas, entries: result };
}

export const extraSchemaPack = () => loadSchemaPack(process.env.BPMN_DESK_EXTRA_SCHEMAS);

/** Каталоги результатов не должны содержать входы или находиться внутри пакета. */
export function assertSeparateOutputs(pack, directories) {
  const within = (parent, child) => {
    const path = relative(parent, child);
    return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`));
  };
  for (const directory of directories) {
    let existing = resolve(directory);
    while (!existsSync(existing)) existing = dirname(existing);
    const output = resolve(realpathSync(existing), relative(existing, resolve(directory)));
    if (within(pack.directory, output) || within(output, pack.directory)) {
      throw new Error('Каталоги результатов не должны пересекаться с пакетом исходных схем.');
    }
  }
}
