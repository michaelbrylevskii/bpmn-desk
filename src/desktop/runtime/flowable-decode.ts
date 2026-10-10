import type { DeadLetterJob, Definition, Execution, Instance, JsonValue, RuntimePage, RuntimeTask, Variable } from '../../shared/runtime';
import { identifier, object } from './validation';

const text = (data: Record<string, unknown>, key: string): string => {
  const value = data[key]; if (value === null || value === undefined) return '';
  if (typeof value !== 'string') throw new Error('Неожиданный формат ответа API.'); return value;
};
const number = (data: Record<string, unknown>, key: string): number => {
  const value = data[key]; if (value === null || value === undefined) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Неожиданный формат ответа API.'); return value;
};
const flag = (data: Record<string, unknown>, key: string): boolean => {
  if (data[key] == null) return false; if (typeof data[key] !== 'boolean') throw new Error('Неожиданный формат ответа API.'); return data[key];
};
export function definition(value: unknown): Definition {
  const d = object(value); return { id: identifier(d.id), key: text(d, 'key'), name: text(d, 'name'), version: number(d, 'version'),
    deploymentId: text(d, 'deploymentId'), tenantId: text(d, 'tenantId'), suspended: flag(d, 'suspended'), graphicalNotationDefined: flag(d, 'graphicalNotationDefined') };
}
export function instance(value: unknown): Instance {
  const d = object(value); return { id: identifier(d.id), name: text(d, 'name'), businessKey: text(d, 'businessKey'), processDefinitionId: identifier(d.processDefinitionId),
    tenantId: text(d, 'tenantId'), suspended: flag(d, 'suspended'), startTime: text(d, 'startTime'), superProcessInstanceId: text(d, 'superProcessInstanceId') };
}
export function execution(value: unknown): Execution {
  const d = object(value); return { id: identifier(d.id), parentId: text(d, 'parentId'), activityId: text(d, 'activityId'), processInstanceId: text(d, 'processInstanceId'), suspended: flag(d, 'suspended') };
}
export function task(value: unknown): RuntimeTask {
  const d = object(value); return { id: identifier(d.id), name: text(d, 'name'), taskDefinitionKey: text(d, 'taskDefinitionKey'), executionId: text(d, 'executionId'), assignee: text(d, 'assignee'), createTime: text(d, 'createTime') };
}
export function deadLetter(value: unknown): DeadLetterJob {
  const d = object(value); return { id: identifier(d.id), processInstanceId: text(d, 'processInstanceId'), processDefinitionId: text(d, 'processDefinitionId'), executionId: text(d, 'executionId'),
    elementId: text(d, 'elementId'), elementName: text(d, 'elementName'), exceptionMessage: text(d, 'exceptionMessage'), retries: number(d, 'retries'), createTime: text(d, 'createTime'), tenantId: text(d, 'tenantId') };
}
function jsonValue(value: unknown, depth = 0): JsonValue {
  if (depth > 30) throw new Error('Переменная API имеет слишком большую вложенность.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(item => jsonValue(item, depth + 1));
  return Object.fromEntries(Object.entries(object(value)).map(([key, item]) => [key, jsonValue(item, depth + 1)]));
}
export function variable(value: unknown): Variable {
  const d = object(value); return { name: text(d, 'name'), type: text(d, 'type'), scope: text(d, 'scope'), value: d.value === undefined ? null : jsonValue(d.value), binary: !!d.valueUrl };
}
export function array<T>(value: unknown, decode: (value: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new Error('API вернул не список.'); return value.map(decode);
}
export function page<T>(value: unknown, decode: (value: unknown) => T): RuntimePage<T> {
  const d = object(value); const total = number(d, 'total'); const start = number(d, 'start');
  if (!Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(start) || start < 0) throw new Error('Недопустимая пагинация API.');
  return { data: array(d.data, decode), total, start };
}
