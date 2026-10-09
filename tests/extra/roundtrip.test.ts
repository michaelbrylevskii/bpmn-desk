import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extraSchemaPack } from '../../scripts/lib/schema-pack.mjs';
import { checkImport } from '../../src/renderer/bpmn/codec';
import { preservationIssues } from '../../src/renderer/bpmn/xml';

const pack = extraSchemaPack();
describe('Дополнительный локальный пакет', () => {
  it.each(pack.entries)('$file сохраняется после двух roundtrip', async entry => {
    const source = readFileSync(entry.path, 'utf8');
    const first = await checkImport(source);
    expect(first.warnings).toEqual([]);
    const second = await checkImport(first.xml);
    expect(second.warnings).toEqual([]);
    expect(preservationIssues(source, second.xml)).toEqual([]);
    mkdirSync('.cache/extra-schema-exports', { recursive: true });
    writeFileSync(resolve('.cache/extra-schema-exports', entry.file), second.xml);
  });
});
