import { translate, type Language } from '../../shared/i18n';
import { modelElements } from './diagnostics';
import type { ModdleElement, Moddle } from './types';
export function createDefinition(moddle: Moddle, type: string, language: Language = 'en'): ModdleElement {
  if (!['Message', 'Signal', 'Error', 'Escalation'].includes(type)) throw new Error('Неподдерживаемый тип определения.');
  return moddle.create(`bpmn:${type}`, { id: `${type}_${crypto.randomUUID().slice(0, 8)}`, name: translate(language, 'Новое {type}', { type }) });
}

export function requireUnused(root: ModdleElement, definition: ModdleElement): void {
  for (const element of modelElements(root)) {
    for (const property of element.$descriptor.properties ?? []) {
      if (!property.isReference) continue;
      const value = element.get<unknown>(property.name);
      if (value === definition || (Array.isArray(value) && value.includes(definition))) {
        throw new Error(`Определение используется в ${element.id ?? element.$type}. Сначала убери ссылку.`);
      }
    }
  }
}
