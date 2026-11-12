import { hasLocalEdits, hasPendingXml, type DocumentRecord } from './types';
import type { MessageKey } from '../../shared/i18n';

export function documentTabStatus(document: DocumentRecord) {
  const local = hasLocalEdits(document);
  const external = !!document.path && !!document.fileState && document.fileState !== 'unchanged';
  const dot = external ? local ? 'conflict' : 'external' : local ? 'local' : !document.path ? 'unbound' : '';
  const messages: MessageKey[] = [];
  if (!document.path) messages.push('Схема не сохранена в файл.');
  messages.push(local ? 'Есть изменения в схеме.' : 'Нет изменений в схеме.');
  if (hasPendingXml(document)) messages.push('Есть неприменённые изменения XML.');
  if (external) messages.push(document.fileState === 'missing' ? 'Файл удалён с диска.' : document.fileState === 'unavailable' ? 'Не удалось проверить файл на диске.' : 'Файл изменён на диске.');
  return { dot, messages };
}
