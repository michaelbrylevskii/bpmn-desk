import type { MessageKey } from '../../shared/i18n';
import { extensionChildren, isExtension } from '../bpmn/extensions';
import type { ModdleElement } from '../bpmn/types';
import { camundaNamespace } from './forms';

export interface ChildSpec { name: string; single?: boolean }
export interface ExtensionSpec {
  title?: MessageKey;
  fields: string[];
  defaults: Record<string, string>;
  children?: ChildSpec[];
  body?: boolean;
  value?: boolean;
}
const single = (name: string): ChildSpec => ({ name, single: true });
const child = (name: string): ChildSpec => ({ name });
export const camundaExtensions: Record<string, ExtensionSpec> = {
  executionListener: { title: 'Обработчики процесса · executionListener', fields: ['event', 'class', 'expression', 'delegateExpression'], defaults: { event: 'start' }, children: [child('field'), single('script')] },
  taskListener: { title: 'Обработчики задачи · taskListener', fields: ['event', 'class', 'expression', 'delegateExpression', 'id'], defaults: { event: 'create' }, children: [child('field'), single('script')] },
  field: { title: 'Поля · field', fields: ['name'], defaults: { name: 'field' } },
  in: { title: 'Входные параметры · in', fields: ['source', 'sourceExpression', 'variables', 'target', 'businessKey', 'local'], defaults: { target: 'variable' } },
  out: { title: 'Выходные параметры · out', fields: ['source', 'sourceExpression', 'variables', 'target', 'local'], defaults: { target: 'variable' } },
  inputOutput: { title: 'Параметры · inputOutput', fields: [], defaults: {}, children: [child('inputParameter'), child('outputParameter')] },
  inputParameter: { fields: ['name'], defaults: { name: 'input' }, value: true },
  outputParameter: { fields: ['name'], defaults: { name: 'output' }, value: true },
  list: { fields: [], defaults: {}, children: [child('value'), child('script'), child('list'), child('map')] },
  map: { fields: [], defaults: {}, children: [child('entry')] },
  entry: { fields: ['key'], defaults: { key: 'key' }, value: true },
  script: { fields: ['scriptFormat', 'resource'], defaults: { scriptFormat: 'javascript' }, body: true },
  value: { fields: ['id', 'name'], defaults: {}, body: true },
  string: { fields: [], defaults: {}, body: true }, expression: { fields: [], defaults: {}, body: true },
  formData: { title: 'Форма · formData', fields: [], defaults: {}, children: [child('formField')] },
  formField: { fields: ['id', 'label', 'type', 'datePattern', 'defaultValue'], defaults: { id: 'field', type: 'string' }, children: [single('properties'), single('validation'), child('value')] },
  validation: { fields: [], defaults: {}, children: [child('constraint')] },
  constraint: { fields: ['name', 'config'], defaults: { name: 'required' } },
  properties: { title: 'Метаданные · properties', fields: [], defaults: {}, children: [child('property')] },
  property: { fields: ['id', 'name', 'value'], defaults: {} },
  formProperty: { title: 'Поля формы · formProperty', fields: ['id', 'name', 'type', 'variable', 'expression', 'default', 'required', 'readable', 'writeable', 'datePattern'], defaults: { id: 'property', type: 'string' }, children: [child('value')] },
  connector: { title: 'Коннектор · connector', fields: [], defaults: {}, children: [single('connectorId'), single('inputOutput')] },
  connectorId: { fields: [], defaults: {}, body: true },
  errorEventDefinition: { title: 'Ошибка внешней задачи · errorEventDefinition', fields: ['id', 'errorRef', 'expression'], defaults: {} },
};

export function rootExtensionsFor(element: ModdleElement): string[] {
  const names = ['properties'];
  if (element.$instanceOf('bpmn:FlowElement') || element.$type === 'bpmn:Process') names.push('executionListener');
  if (element.$type === 'bpmn:UserTask') names.push('taskListener');
  if (['bpmn:UserTask', 'bpmn:StartEvent'].includes(element.$type)) names.push('formData', 'formProperty');
  if (element.$type === 'bpmn:CallActivity') names.push('in', 'out');
  if (element.$instanceOf('bpmn:Activity') || ['bpmn:IntermediateCatchEvent', 'bpmn:IntermediateThrowEvent', 'bpmn:EndEvent'].includes(element.$type)) names.push('inputOutput');
  if (['bpmn:ServiceTask', 'bpmn:SendTask', 'bpmn:BusinessRuleTask', 'bpmn:MessageEventDefinition'].includes(element.$type)) names.push('field', 'connector', 'errorEventDefinition');
  return names;
}

/** Контейнеры, описанные спецификацией как единственные, нельзя дублировать из UI. */
export function availableChildren(element: ModdleElement, specification: ExtensionSpec): ChildSpec[] {
  return (specification.children ?? []).filter(child => !child.single || !extensionChildren(element).some(node => isExtension(node, camundaNamespace.uri, child.name)));
}
