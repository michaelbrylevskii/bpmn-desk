import type { Diagnostic, ModdleElement } from './types';

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

export function validateModel(root: ModdleElement): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const items = modelElements(root);
  for (const element of items) {
    const elementId = element.id;
    if (element.$type === 'bpmn:ServiceTask' && !['flowable:class', 'flowable:expression', 'flowable:delegateExpression', 'flowable:type']
      .some(key => element.$attrs?.[key])) {
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
