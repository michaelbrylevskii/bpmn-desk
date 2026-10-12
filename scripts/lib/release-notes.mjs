import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Публикационный английский текст и один источник русского перевода. */
export function releaseNotes(directory, version) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Некорректная версия release notes.');
  const english = readFileSync(join(directory, '.github/release-notes', `${version}.md`), 'utf8').trim();
  const russian = readFileSync(join(directory, 'docs/releases', `${version}.md`), 'utf8').trim();
  if (!english || !russian) throw new Error('Оба языка release notes должны быть заполнены.');
  return `${english}\n\n<details>\n<summary>Русский</summary>\n\n${russian}\n\n</details>\n`;
}
