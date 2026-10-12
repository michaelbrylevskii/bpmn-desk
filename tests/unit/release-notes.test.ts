import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, beforeEach, expect, it } from 'vitest';

const script = resolve('scripts/release-notes.mjs'); let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'desk-notes-'));
  mkdirSync(join(directory, 'docs/releases'), { recursive: true });
  mkdirSync(join(directory, '.github/release-notes'), { recursive: true });
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '1.2.3' }));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));
function write(version: string, english: string, russian: string) {
  writeFileSync(join(directory, `.github/release-notes/${version}.md`), english);
  writeFileSync(join(directory, `docs/releases/${version}.md`), russian);
}
function run(version?: string) { return spawnSync(process.execPath, [script, ...(version ? [version] : [])], { cwd: directory, encoding: 'utf8' }); }
it('публикует английский текст и сохраняет русский Markdown в закрытом спойлере', () => {
  const russian = '# Релиз\n\n```xml\n<task name="Пример"/>\n```';
  write('1.2.3', '# Release\n\n[Checks](https://example.org/checks)', russian);
  const result = run(); expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/^# Release/); expect(result.stdout).toContain('[Checks](https://example.org/checks)');
  expect(result.stdout).toContain('<details>\n<summary>Русский</summary>\n\n' + russian);
  expect(result.stdout.trim()).toMatch(/<\/details>$/); expect(result.stdout).not.toContain('<details open');
});
it('версия выбирает собственные тексты, отсутствие перевода и обход каталога блокируются', () => {
  write('1.2.3', 'Current', 'Текущий'); write('1.0.0', 'Previous', 'Предыдущий');
  const previous = run('1.0.0'); expect(previous.status).toBe(0); expect(previous.stdout).toContain('Previous'); expect(previous.stdout).not.toContain('Current');
  writeFileSync(join(directory, 'docs/releases/1.0.0.md'), '  '); expect(run('1.0.0').status).not.toBe(0);
  expect(run('../../LICENSE').stderr).toContain('Некорректная версия'); expect(run('1.0.1').status).not.toBe(0);
});
