import type { Diagnostic, ModdleElement } from './types';
import { namespacedValue, namespaceUri } from './namespaces';
import { flowableNamespace } from '../flowable/attributes';
import { camundaNamespace } from '../camunda/forms';
import { validateCamunda } from '../camunda/diagnostics';
import type { EngineId } from '../engines/contracts';

/** Обходит containment properties без ссылок и циклического $parent. */
export function modelElements(root: ModdleElement): ModdleElement[] {
  const result: ModdleElement[] = [];
  const visited = new Set<ModdleElement>();
  const visit = (element: ModdleElement) => {
    if (visited.has(element)) return;
    visited.add(element); result.push(element);
    for (const descriptor of element.$descriptor?.properties ?? []) {
      if (descriptor.isReference || descriptor.isVirtual || ['String', 'Boolean', 'Integer', 'Real'].includes(descriptor.type)) continue;
      const value = element.get<unknown>(descriptor.name);
      for (const child of Array.isArray(value) ? value : [value]) {
        if (child && typeof child === 'object' && '$type' in child) visit(child as ModdleElement);
      }
    }
  };
  visit(root);
  return result;
}

export function validateModel(root: ModdleElement, engines: EngineId[] = []): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (engines.length > 1) diagnostics.push({ severity: 'warning', message: 'Смешанные расширения Flowable и Camunda 7. Проверь совместимость с выбранным движком.' });
  const items = modelElements(root);
  for (const element of items) {
    const elementId = element.id;
    const has = (uri: string) => Object.keys(element.$attrs ?? {}).some(key => namespaceUri(element, key.split(':')[0]!) === uri);
    if (engines.includes('camunda7') && (engines.length === 1 || has(camundaNamespace.uri))) diagnostics.push(...validateCamunda(element));
    if (engines.includes('flowable') && (engines.length === 1 || has(flowableNamespace.uri)) && element.$type === 'bpmn:ServiceTask' && !['class', 'expression', 'delegateExpression', 'type']
      .some(name => namespacedValue(element, name, flowableNamespace))) {
      diagnostics.push({ severity: 'warning', elementId, message: 'Сервисная задача: не задана реализация Flowable.' });
    }
    if (element.$type === 'bpmn:CallActivity' && !element.get('calledElement')) {
      diagnostics.push({ severity: 'warning', elementId, message: 'Вызов процесса: не указан вызываемый процесс.' });
    }
    if (element.$type === 'bpmn:Process' && !element.get<ModdleElement[]>('flowElements')?.some(e => e.$type === 'bpmn:StartEvent')) {
      diagnostics.push({ severity: 'warning', elementId, message: 'В процессе нет начального события.' });
    }
  }
  return diagnostics;
}
