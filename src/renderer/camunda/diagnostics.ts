import { extensionChildren, extensionValues, isExtension } from '../bpmn/extensions';
import { namespacedValue } from '../bpmn/namespaces';
import type { Diagnostic, ModdleElement } from '../bpmn/types';
import { camundaNamespace } from './forms';

export function validateCamunda(element: ModdleElement): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const value = (name: string) => namespacedValue(element, name, camundaNamespace);
  const warn = (message: string) => diagnostics.push({ severity: 'warning', elementId: element.id, message });
  const extensions = extensionValues(element);
  if (['bpmn:ServiceTask', 'bpmn:SendTask', 'bpmn:BusinessRuleTask'].includes(element.$type)) {
    const implementations = ['class', 'expression', 'delegateExpression', 'type', 'decisionRef'].filter(name => value(name));
    const connector = extensions.some(node => isExtension(node, camundaNamespace.uri, 'connector'));
    if (!implementations.length && !connector) warn('Сервисная задача: не задана реализация Camunda 7.');
    if (implementations.length + Number(connector) > 1) warn('Camunda 7: одновременно заданы несколько реализаций задачи.');
    if (value('type') === 'external' && !value('topic')) warn('Внешняя задача Camunda 7: не задана тема.');
  }
  for (const prefix of ['calledElement', 'decisionRef', 'formRef']) {
    const binding = value(`${prefix}Binding`);
    const field = `${prefix}${binding === 'versionTag' ? 'VersionTag' : 'Version'}`;
    if (['version', 'versionTag'].includes(binding) && !value(field)) warn(`Camunda 7: для ${binding} укажи ${field}.`);
  }
  const visit = (node: ModdleElement) => {
    const children = extensionChildren(node);
    if (['inputParameter', 'outputParameter', 'entry'].some(name => isExtension(node, camundaNamespace.uri, name))) {
      const types = children.filter(child => ['map', 'list', 'script'].some(name => isExtension(child, camundaNamespace.uri, name))).length;
      if (types + Number(typeof node.$body === 'string' && !!node.$body.trim()) > 1) warn(`Camunda 7: параметр ${node.name ?? node.key ?? ''} содержит несколько типов значения.`);
    }
    children.forEach(visit);
  };
  extensions.forEach(visit);
  return diagnostics;
}
