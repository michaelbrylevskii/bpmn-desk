import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, afterEach, expect, it } from 'vitest';
import { assertSeparateOutputs, loadSchemaPack } from '../../scripts/lib/schema-pack.mjs';
import { recordExtraResults, verifyExtraResults } from '../../scripts/lib/extra-results.mjs';

let directory: string;
const source = '<definitions />';
const sha256 = createHash('sha256').update(source).digest('hex');
const manifest = (records: unknown) => writeFileSync(join(directory, 'provenance.json'), JSON.stringify(records));
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'bpmn-schema-pack-'));
  mkdirSync(join(directory, 'schemas'));
  writeFileSync(join(directory, 'schemas', 'example.bpmn'), source);
  manifest([{ file: 'example.bpmn', sha256 }]);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

it('проверяет SHA-256 и возвращает пути без изменения входов', () => {
  expect(loadSchemaPack(directory).entries).toEqual([{ file: 'example.bpmn', path: join(directory, 'schemas', 'example.bpmn'), sha256 }]);
  expect(readFileSync(join(directory, 'schemas', 'example.bpmn'), 'utf8')).toBe(source);
  expect(JSON.parse(readFileSync(join(directory, 'provenance.json'), 'utf8'))).toEqual([{ file: 'example.bpmn', sha256 }]);
});
it('отклоняет пересечение результатов и входов до изменения файлов', () => {
  const pack = loadSchemaPack(directory);
  for (const output of [directory, join(directory, 'outputs'), join(directory, '..')]) {
    expect(() => assertSeparateOutputs(pack, [output])).toThrow('пересекаться');
  }
  expect(() => assertSeparateOutputs(pack, [`${directory}-outputs`])).not.toThrow();
  expect(readFileSync(join(directory, 'schemas', 'example.bpmn'), 'utf8')).toBe(source);
});
it.skipIf(process.platform === 'win32')('учитывает ссылки в путях ещё не созданных результатов', () => {
  const link = `${directory}-output-link`;
  symlinkSync(join(directory, 'schemas'), link, 'dir');
  try {
    expect(() => assertSeparateOutputs(loadSchemaPack(directory), [join(link, 'nested')])).toThrow('пересекаться');
  } finally { rmSync(link); }
  expect(readFileSync(join(directory, 'schemas', 'example.bpmn'), 'utf8')).toBe(source);
});
it('отклоняет повреждённый checksum', () => {
  manifest([{ file: 'example.bpmn', sha256: '0'.repeat(64) }]);
  expect(() => loadSchemaPack(directory)).toThrow('SHA-256');
});
it('отклоняет пустой manifest, дубли и пути за пределами пакета', () => {
  manifest([]); expect(() => loadSchemaPack(directory)).toThrow('непустой');
  manifest([{ file: 'example.bpmn', sha256 }, { file: 'EXAMPLE.bpmn', sha256 }]);
  expect(() => loadSchemaPack(directory)).toThrow('Повтор');
  for (const file of ['../example.bpmn', '..\\example.bpmn']) {
    manifest([{ file, sha256 }]); expect(() => loadSchemaPack(directory)).toThrow('безопасное');
  }
});
it('не пропускает схему, не перечисленную в provenance', () => {
  writeFileSync(join(directory, 'schemas', 'unlisted.xml'), source);
  expect(() => loadSchemaPack(directory)).toThrow('перечислена');
});
it('отклоняет неверный UTF-8 даже при правильной контрольной сумме', () => {
  const bytes = Buffer.from([0xc3, 0x28]);
  writeFileSync(join(directory, 'schemas', 'example.bpmn'), bytes);
  manifest([{ file: 'example.bpmn', sha256: createHash('sha256').update(bytes).digest('hex') }]);
  expect(() => loadSchemaPack(directory)).toThrow('UTF-8');
});
it.skipIf(process.platform === 'win32')('отклоняет ссылку за пределы каталога schemas', () => {
  symlinkSync(join(directory, 'provenance.json'), join(directory, 'schemas', 'outside.bpmn'));
  manifest([{ file: 'outside.bpmn', sha256 }]);
  expect(() => loadSchemaPack(directory)).toThrow('внутри schemas');
});
it('независимая проверка не использует изменённый экспорт или другой пакет', () => {
  const pack = loadSchemaPack(directory);
  const output = join(directory, 'exports');
  mkdirSync(output); writeFileSync(join(output, 'example.bpmn'), source);
  expect(() => verifyExtraResults(pack, output)).toThrow('устарели');
  recordExtraResults(pack, output);
  expect(() => verifyExtraResults(pack, output)).not.toThrow();
  expect(() => verifyExtraResults({ ...pack, entries: [{ ...pack.entries[0]!, sha256: '0'.repeat(64) }] }, output)).toThrow('устарели');
  writeFileSync(join(output, 'example.bpmn'), '<changed />');
  expect(() => verifyExtraResults(pack, output)).toThrow('устарели');
});
