import type { Language } from '../../shared/i18n';

/** Ключи — публичные phrase names CodeMirror и компактной панели. */
export function searchPhrases(language: Language): Record<string, string> {
  return language === 'en' ? {} : {
    'Find': 'Найти', 'Replace': 'Заменить', 'Next match': 'Следующее совпадение', 'Previous match': 'Предыдущее совпадение',
    'Match case': 'Учитывать регистр', 'Regular expression': 'Регулярное выражение', 'Whole words': 'Целые слова',
    'Show replacement': 'Показать замену', 'Close search': 'Закрыть поиск', 'Select all': 'Выделить все', 'Replace all': 'Заменить все',
    'Invalid expression': 'Ошибка выражения', 'Matches': 'Совпадения', 'XML search': 'Поиск XML',
    'Go to line': 'Перейти к строке', 'go': 'Перейти', 'current match': 'Текущее совпадение', 'on line': 'на строке',
  };
}
