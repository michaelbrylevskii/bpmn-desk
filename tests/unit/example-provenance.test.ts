import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import provenance from '../../examples/provenance.json';

it('встроенные схемы соответствуют provenance и имеют явные лицензии', () => {
  const files = readdirSync('examples').filter(file => file.endsWith('.bpmn20.xml')).sort();
  expect(provenance.map(record => record.file).sort()).toEqual(files);
  for (const record of provenance) {
    expect(createHash('sha256').update(readFileSync(`examples/${record.file}`)).digest('hex')).toBe(record.sha256);
    expect(['MIT', 'Apache-2.0']).toContain(record.license);
    if (record.license === 'Apache-2.0') {
      expect(record.source).toMatch(/^https:\/\/github\.com\/flowable\/flowable-examples\/blob\/[0-9a-f]{40}\//);
      expect(record.modified).toBe(false);
    }
  }
});
