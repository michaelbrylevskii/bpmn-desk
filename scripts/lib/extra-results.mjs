import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checksum = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const inputs = pack => pack.entries.map(({ file, sha256 }) => ({ file, sha256 }));

/** Receipt появляется только после успешного roundtrip и UI-прогона. */
export function recordExtraResults(pack, directory = '.cache/extra-schema-exports') {
  const sources = inputs(pack);
  for (const entry of pack.entries) {
    if (checksum(entry.path) !== entry.sha256) throw new Error('Входная схема изменилась во время дополнительного прогона.');
  }
  const exports = pack.entries.map(({ file }) => ({ file, sha256: checksum(resolve(directory, file)) }));
  writeFileSync(resolve(directory, 'completed.json'), JSON.stringify({ inputs: sources, exports }, null, 2) + '\n');
}

export function verifyExtraResults(pack, directory = '.cache/extra-schema-exports') {
  try {
    const receipt = JSON.parse(readFileSync(resolve(directory, 'completed.json'), 'utf8'));
    if (JSON.stringify(receipt.inputs) !== JSON.stringify(inputs(pack)) || !Array.isArray(receipt.exports) ||
        receipt.exports.length !== pack.entries.length) throw new Error('Неверные входы');
    for (const entry of pack.entries) {
      const exported = receipt.exports.find(record => record.file === entry.file);
      if (!exported || checksum(resolve(directory, entry.file)) !== exported.sha256) throw new Error('Неверный экспорт');
    }
  } catch {
    throw new Error('Дополнительные экспорты отсутствуют или устарели. Повтори npm run test:extra с текущим пакетом.');
  }
}
