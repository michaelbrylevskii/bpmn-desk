import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultLanguage, isLanguage, translate, translateText } from '../../src/shared/i18n';
import { LanguageSettings } from '../../src/desktop/language-settings';

it('по умолчанию en; параметры и неизвестные технические сообщения сохраняются', () => {
  expect(defaultLanguage).toBe('en');
  expect(isLanguage('es')).toBe(false);
  expect(translate('en', 'Закрыть {name}', { name: 'Схема' })).toBe('Close Схема');
  expect(translate('ru', 'Закрыть {name}', { name: 'Схема' })).toBe('Закрыть Схема');
  expect(translateText('en', 'Некорректный XML: bad tag')).toBe('Invalid XML: bad tag');
  expect(translateText('ru', 'Close “Схема” and discard unsaved changes?')).toBe('Закрыть «Схема» и отбросить несохранённые изменения?');
  expect(translateText('en', "Error invoking remote method 'documents:save': Error: Файл изменён другим приложением. Открой его заново или используй «Сохранить как»."))
    .toBe('The file was changed by another application. Reopen it or use “Save as”.');
  expect(translateText('ru', 'Technical error in task_1')).toBe('Technical error in task_1');
});

it('настройка языка восстанавливается; неверное значение отклоняется, повреждённое даёт en', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bpmn-locale-'));
  try {
    const first = new LanguageSettings(directory); await first.load(); expect(first.get()).toBe('en');
    await first.set('ru');
    const second = new LanguageSettings(directory); await second.load(); expect(second.get()).toBe('ru');
    expect(await readFile(join(directory, 'language.json'), 'utf8')).toBe('"ru"');
    await expect(second.set('xx' as 'en')).rejects.toThrow('язык');
    await writeFile(join(directory, 'language.json'), '{broken'); await second.load();
    expect(second.get()).toBe('en');
    // Новый экземпляр всегда начинает с defaultLanguage.
    const broken = new LanguageSettings(directory); await broken.load(); expect(broken.get()).toBe('en');
    await rm(directory, { recursive: true, force: true });
    await expect(broken.set('ru')).rejects.toThrow();
    expect(broken.get()).toBe('en');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
