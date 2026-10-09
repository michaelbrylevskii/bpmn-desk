import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from './file-store';
import { defaultLanguage, isLanguage, type Language } from '../shared/i18n';

/** Профиль Electron — единственный источник языка desktop; система не переопределяет en. */
export class LanguageSettings {
  private current: Language = defaultLanguage;
  private writes = Promise.resolve();
  constructor(private readonly directory: string) {}
  get(): Language { return this.current; }
  async load(): Promise<void> {
    this.current = defaultLanguage;
    try { const value: unknown = JSON.parse(await readFile(join(this.directory, 'language.json'), 'utf8')); if (isLanguage(value)) this.current = value; }
    catch { /* Первый запуск или повреждённая настройка: английский. */ }
  }
  set(value: Language): Promise<void> {
    if (!isLanguage(value)) return Promise.reject(new Error('Недопустимый язык интерфейса.'));
    this.writes = this.writes.catch(() => undefined).then(async () => { await atomicWrite(join(this.directory, 'language.json'), JSON.stringify(value)); this.current = value; });
    return this.writes;
  }
}
