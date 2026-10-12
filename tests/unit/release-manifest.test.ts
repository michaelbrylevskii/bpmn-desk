import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, afterEach, expect, it } from 'vitest';

const script = resolve('scripts/release-manifest.mjs');
const files = ['BPMN-Desk-0.2.0-x86_64.AppImage', 'BPMN-Desk-0.2.0-x64-Setup.exe', 'BPMN-Desk-0.2.0-x64-Portable.exe'];
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'bpmn-desk-release-'));
  mkdirSync(join(directory, 'release'));
  mkdirSync(join(directory, 'docs/releases'), { recursive: true });
  mkdirSync(join(directory, '.github/release-notes'), { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '0.2.0' }));
  writeFileSync(join(directory, 'docs/releases/0.2.0.md'), 'Проверочная поставка');
  writeFileSync(join(directory, '.github/release-notes/0.2.0.md'), 'Test release');
  for (const file of files) writeFileSync(join(directory, 'release', file), `contents: ${file}`);
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
function run(tag = 'v0.2.0') {
  return spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8',
    env: { ...process.env, GITHUB_REF_TYPE: 'tag', GITHUB_REF_NAME: tag } });
}
it('создаёт проверяемый manifest ровно трёх дистрибутивов', () => {
  expect(run().status).toBe(0);
  const sums = readFileSync(join(directory, 'release/SHA256SUMS'), 'utf8').trim().split('\n');
  expect(sums).toHaveLength(3);
  for (const file of files) {
    const hash = createHash('sha256').update(readFileSync(join(directory, 'release', file))).digest('hex');
    expect(sums).toContain(`${hash}  ${file}`);
  }
});
it('блокирует релиз с другим тегом и чужим или пустым артефактом', () => {
  expect(run('v0.3.0').status).not.toBe(0);
  const foreign = join(directory, 'release/foreign.exe');
  writeFileSync(foreign, 'foreign');
  expect(run().status).not.toBe(0);
  rmSync(foreign);
  writeFileSync(join(directory, 'release', files[0]!), '');
  expect(run().status).not.toBe(0);
});
it('требует release notes до подготовки manifest', () => {
  rmSync(join(directory, 'docs/releases/0.2.0.md'));
  expect(run().status).not.toBe(0);
  writeFileSync(join(directory, 'docs/releases/0.2.0.md'), 'Проверочная поставка');
  rmSync(join(directory, '.github/release-notes/0.2.0.md'));
  expect(run().status).not.toBe(0);
});
