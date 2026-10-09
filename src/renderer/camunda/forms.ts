import type { EngineField } from '../engines/contracts';
import { namespaceUri } from '../bpmn/namespaces';
import type { ModdleElement } from '../bpmn/types';

export const camundaNamespace = { uri: 'http://camunda.org/schema/1.0/bpmn', prefix: 'camunda' };
const fields: EngineField[] = [
  { name: 'class', label: 'Java-класс' }, { name: 'expression', label: 'Выражение' }, { name: 'delegateExpression', label: 'Выражение делегата' },
  { name: 'resultVariable', label: 'Переменная результата' }, { name: 'type', label: 'Тип реализации', options: ['external', 'mail', 'shell'] },
  { name: 'topic', label: 'Тема внешней задачи' }, { name: 'taskPriority', label: 'Приоритет внешней задачи' },
  { name: 'assignee', label: 'Исполнитель' }, { name: 'candidateUsers', label: 'Пользователи-кандидаты' }, { name: 'candidateGroups', label: 'Группы-кандидаты' },
  { name: 'dueDate', label: 'Срок выполнения' }, { name: 'followUpDate', label: 'Дата напоминания' }, { name: 'priority', label: 'Приоритет' },
  { name: 'formKey', label: 'Ключ формы' }, { name: 'formHandlerClass', label: 'Класс обработчика формы' },
  { name: 'formRef', label: 'Ссылка на форму' }, { name: 'formRefBinding', label: 'Привязка формы', options: ['latest', 'deployment', 'version'] }, { name: 'formRefVersion', label: 'Версия формы' },
  { name: 'asyncBefore', label: 'Асинхронно до выполнения', type: 'boolean', defaultValue: 'false' },
  { name: 'asyncAfter', label: 'Асинхронно после выполнения', type: 'boolean', defaultValue: 'false' },
  { name: 'exclusive', label: 'Последовательное выполнение заданий', type: 'boolean', defaultValue: 'true' }, { name: 'jobPriority', label: 'Приоритет заданий' },
  { name: 'initiator', label: 'Инициатор' }, { name: 'candidateStarterUsers', label: 'Кто может запускать: пользователи' }, { name: 'candidateStarterGroups', label: 'Кто может запускать: группы' },
  { name: 'historyTimeToLive', label: 'Срок хранения истории' }, { name: 'versionTag', label: 'Метка версии' },
  { name: 'isStartableInTasklist', label: 'Доступен для запуска в Tasklist', type: 'boolean', defaultValue: 'true' },
  { name: 'calledElementBinding', label: 'Привязка вызываемого процесса', options: ['latest', 'deployment', 'version', 'versionTag'] },
  { name: 'calledElementVersion', label: 'Версия вызываемого процесса' }, { name: 'calledElementVersionTag', label: 'Метка версии вызываемого процесса' }, { name: 'calledElementTenantId', label: 'Tenant вызываемого процесса' },
  { name: 'variableMappingClass', label: 'Класс преобразования переменных' }, { name: 'variableMappingDelegateExpression', label: 'Делегат преобразования переменных' },
  { name: 'decisionRef', label: 'Ссылка на решение DMN' }, { name: 'decisionRefBinding', label: 'Привязка решения', options: ['latest', 'deployment', 'version', 'versionTag'] },
  { name: 'decisionRefVersion', label: 'Версия решения' }, { name: 'decisionRefVersionTag', label: 'Метка версии решения' }, { name: 'decisionRefTenantId', label: 'Tenant решения' },
  { name: 'mapDecisionResult', label: 'Преобразование результата решения', options: ['singleEntry', 'singleResult', 'collectEntries', 'resultList'] },
  { name: 'resource', label: 'Ресурс скрипта' }, { name: 'collection', label: 'Коллекция' }, { name: 'elementVariable', label: 'Переменная элемента' },
  { name: 'errorCodeVariable', label: 'Переменная кода ошибки' }, { name: 'errorMessageVariable', label: 'Переменная сообщения ошибки' },
  { name: 'escalationCodeVariable', label: 'Переменная кода эскалации' }, { name: 'variableName', label: 'Переменная условия' }, { name: 'variableEvents', label: 'События переменной' },
];
const implementations = ['class', 'expression', 'delegateExpression', 'resultVariable', 'type', 'topic', 'taskPriority'];
const form = ['formKey', 'formHandlerClass', 'formRef', 'formRefBinding', 'formRefVersion'];
const specialized: Record<string, string[]> = {
  'bpmn:Process': ['jobPriority', 'taskPriority', 'candidateStarterUsers', 'candidateStarterGroups', 'historyTimeToLive', 'versionTag', 'isStartableInTasklist'],
  'bpmn:ServiceTask': implementations, 'bpmn:SendTask': implementations, 'bpmn:MessageEventDefinition': implementations,
  'bpmn:UserTask': ['assignee', 'candidateUsers', 'candidateGroups', 'dueDate', 'followUpDate', 'priority', ...form],
  'bpmn:StartEvent': ['initiator', ...form],
  'bpmn:ScriptTask': ['resultVariable', 'resource'],
  'bpmn:CallActivity': ['calledElementBinding', 'calledElementVersion', 'calledElementVersionTag', 'calledElementTenantId', 'variableMappingClass', 'variableMappingDelegateExpression'],
  'bpmn:BusinessRuleTask': [...implementations, 'decisionRef', 'decisionRefBinding', 'decisionRefVersion', 'decisionRefVersionTag', 'decisionRefTenantId', 'mapDecisionResult'],
  'bpmn:MultiInstanceLoopCharacteristics': ['collection', 'elementVariable', 'asyncBefore', 'asyncAfter', 'exclusive'],
  'bpmn:ErrorEventDefinition': ['errorCodeVariable', 'errorMessageVariable'], 'bpmn:EscalationEventDefinition': ['escalationCodeVariable'],
  'bpmn:ConditionalEventDefinition': ['variableName', 'variableEvents'],
};

export function camundaFieldsFor(element: ModdleElement): EngineField[] {
  const common = element.$instanceOf('bpmn:FlowNode') ? ['asyncBefore', 'asyncAfter', 'exclusive', 'jobPriority'] : [];
  const existing = Object.keys(element.$attrs ?? {}).filter(key => namespaceUri(element, key.split(':')[0]!) === camundaNamespace.uri).map(key => key.split(':')[1]!);
  const names = new Set([...common, ...(specialized[element.$type] ?? []), ...existing]);
  return fields.filter(field => names.has(field.name));
}
