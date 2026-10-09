import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error('Некорректная версия приложения.');
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${version}`) {
  throw new Error('Тег релиза должен соответствовать версии package.json.');
}
const files = [`BPMN-Desk-${version}-x86_64.AppImage`, `BPMN-Desk-${version}-x64-Setup.exe`, `BPMN-Desk-${version}-x64-Portable.exe`];
const found = readdirSync('release').filter(file => /\.(AppImage|exe)$/.test(file)).sort();
if (JSON.stringify(found) !== JSON.stringify([...files].sort())) throw new Error('Ожидаются ровно три дистрибутива текущей версии.');
readFileSync(`docs/releases/${version}.md`, 'utf8');
const sums = files.map(file => {
  const path = `release/${file}`;
  if (!statSync(path).isFile() || statSync(path).size === 0) throw new Error(`Пустой дистрибутив: ${file}`);
  return `${createHash('sha256').update(readFileSync(path)).digest('hex')}  ${file}`;
});
writeFileSync('release/SHA256SUMS', sums.join('\n') + '\n');
process.stdout.write(sums.join('\n') + '\n');
