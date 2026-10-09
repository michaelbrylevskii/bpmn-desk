import { expect, it } from 'vitest';
import { errorNotice } from '../../src/renderer/notifications/errors';

it('контекст XML отделяет пояснение от полного вывода парсера', () => {
  const details = 'unparsable content gibberish\nline: 4\ncolumn: 4';
  const notice = errorNotice(new Error(details), { title: 'Не удалось применить XML.', message: 'Изменения не применены.' });
  expect(notice).toEqual({ severity: 'error', title: 'Не удалось применить XML.', message: 'Изменения не применены.', details });
});

it('не определяет тип по тексту ошибки и сохраняет неизвестные причины', () => {
  expect(errorNotice(new Error('Saved: name.bpmn')).severity).toBe('error');
  expect(errorNotice('unknown rejection')).toEqual({ severity: 'error', title: 'Не удалось выполнить действие.', message: 'unknown rejection', details: undefined });
});
