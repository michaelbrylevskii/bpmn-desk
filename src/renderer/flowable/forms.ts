import type { ModdleElement } from '../bpmn/types';
import { flowableBooleans, flowableStrings } from './descriptor';

export const labels: Record<string, string> = {
  class: 'Java-класс', expression: 'Выражение', delegateExpression: 'Выражение делегата',
  resultVariableName: 'Переменная результата', assignee: 'Исполнитель', owner: 'Владелец',
  candidateUsers: 'Пользователи-кандидаты', candidateGroups: 'Группы-кандидаты', dueDate: 'Срок выполнения',
  priority: 'Приоритет', category: 'Категория', formKey: 'Ключ формы',
  async: 'Асинхронно до выполнения', asyncLeave: 'Асинхронно после выполнения', exclusive: 'Последовательное выполнение заданий',
  inheritVariables: 'Наследовать переменные', inheritBusinessKey: 'Наследовать бизнес-ключ',
  sameDeployment: 'Процесс из того же развёртывания', fallbackToDefaultTenant: 'Использовать tenant по умолчанию', initiator: 'Инициатор',
  candidateStarterUsers: 'Кто может запускать: пользователи', candidateStarterGroups: 'Кто может запускать: группы',
  collection: 'Коллекция', elementVariable: 'Переменная элемента',
  jobPriority: 'Приоритет заданий', historyLevel: 'Уровень истории', businessKey: 'Бизнес-ключ',
  asyncLeaveExclusive: 'Последовательное выполнение заданий после выхода', triggerable: 'Ожидать внешнее продолжение',
  calledElementType: 'Тип ссылки на процесс', autoStoreVariables: 'Сохранять переменные скрипта',
  formFieldValidation: 'Проверять поля формы', taskIdVariableName: 'Переменная ID задачи',
};

export function fieldsFor(element: ModdleElement): { strings: string[]; booleans: string[] } {
  const type = element.$type;
  const common = ['async', 'asyncLeave', 'exclusive', 'asyncLeaveExclusive', 'jobPriority'];
  const specialized: Record<string, string[]> = {
    'bpmn:ServiceTask': ['class', 'expression', 'delegateExpression', 'resultVariableName', 'type', 'triggerable'],
    'bpmn:UserTask': ['assignee', 'owner', 'candidateUsers', 'candidateGroups', 'dueDate', 'priority', 'category', 'formKey', 'formFieldValidation', 'taskIdVariableName'],
    'bpmn:CallActivity': ['inheritVariables', 'inheritBusinessKey', 'sameDeployment', 'fallbackToDefaultTenant', 'calledElementType', 'businessKey'],
    'bpmn:Process': ['candidateStarterUsers', 'candidateStarterGroups', 'historyLevel'],
    'bpmn:StartEvent': ['initiator', 'formKey'],
    'bpmn:ScriptTask': ['resultVariableName', 'autoStoreVariables'],
  };
  const existing = Object.keys(element.$attrs ?? {}).filter(k => k.startsWith('flowable:')).map(k => k.slice(9));
  const names = new Set([...common, ...(specialized[type] ?? []), ...existing]);
  return { strings: flowableStrings.filter(name => names.has(name) && !name.includes('Docker')), booleans: flowableBooleans.filter(name => names.has(name)) };
}
