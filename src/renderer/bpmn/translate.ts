import type { Language } from '../../shared/i18n';
const messages: Record<string, string> = {
  'Activate hand tool': 'Перемещение холста', 'Activate lasso tool': 'Выделение области',
  'Activate create/remove space tool': 'Добавить или убрать пространство', 'Activate global connect tool': 'Соединить элементы',
  'Create start event': 'Создать начальное событие', 'Create intermediate/boundary event': 'Создать промежуточное или граничное событие',
  'Create end event': 'Создать конечное событие', 'Create gateway': 'Создать шлюз', 'Create task': 'Создать задачу',
  'Create expanded sub-process': 'Создать развёрнутый подпроцесс', 'Create pool/participant': 'Создать пул участника',
  'Create data object reference': 'Создать объект данных', 'Create data store reference': 'Создать хранилище данных', 'Create group': 'Создать группу',
  'Delete': 'Удалить', 'Change element': 'Изменить тип элемента', 'Add text annotation': 'Добавить примечание',
  'Connect to other element': 'Соединить с другим элементом', 'Connect using association': 'Соединить ассоциацией',
  'Connect using data input association': 'Связать с входными данными',
  'Append task': 'Добавить задачу', 'Append gateway': 'Добавить шлюз', 'Append end event': 'Добавить конечное событие',
  'Append receive task': 'Добавить задачу получения', 'Append intermediate/boundary event': 'Добавить промежуточное или граничное событие',
  'Add lane above': 'Добавить дорожку сверху', 'Add lane below': 'Добавить дорожку снизу',
  'Divide into two lanes': 'Разделить на две дорожки', 'Divide into three lanes': 'Разделить на три дорожки',
  'Search in diagram': 'Поиск по схеме', 'Search': 'Поиск', 'No results found': 'Ничего не найдено',
  'Task': 'Задача', 'User task': 'Пользовательская задача', 'Service task': 'Сервисная задача',
  'Script task': 'Задача со скриптом', 'Business rule task': 'Задача бизнес-правил', 'Send task': 'Задача отправки',
  'Receive task': 'Задача получения', 'Manual task': 'Ручная задача', 'Call activity': 'Вызов процесса',
  'Start event': 'Начальное событие', 'End event': 'Конечное событие', 'Intermediate catch event': 'Промежуточное принимающее событие',
  'Intermediate throw event': 'Промежуточное генерирующее событие', 'Exclusive gateway': 'Исключающий шлюз',
  'Parallel gateway': 'Параллельный шлюз', 'Inclusive gateway': 'Включающий шлюз', 'Event based gateway': 'Событийный шлюз',
  'Sub-process (collapsed)': 'Свёрнутый подпроцесс', 'Sub-process (expanded)': 'Развёрнутый подпроцесс',
  'Loop': 'Цикл', 'Parallel multi-instance': 'Параллельные экземпляры', 'Sequential multi-instance': 'Последовательные экземпляры',
};

/** Сервис переводов bpmn-js: неизвестные редкие термины остаются исходными. */
export function translate(template: string, replacements: Record<string, string> = {}, language: Language = 'en'): string {
  return (language === 'ru' ? messages[template] ?? template : template).replace(/\{([^}]+)\}/g, (whole, key: string) => replacements[key] ?? whole);
}
export const translationModule = (language: () => Language) => ({ translate: ['value', (template: string, replacements?: Record<string, string>) => translate(template, replacements, language())] });
