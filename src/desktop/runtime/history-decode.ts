import type { HistoricActivity, HistoricInstance, HistoryQuery } from '../../shared/history';
import { instance } from './flowable-decode';
import { identifier, object, pageQuery } from './validation';

function text(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Неожиданный формат ответа API.');
  return value;
}
function date(data: Record<string, unknown>, key: string): string {
  const value = text(data, key);
  if (value && !Number.isFinite(Date.parse(value))) throw new Error('Неожиданный формат ответа API.');
  return value;
}
function duration(data: Record<string, unknown>): number | null {
  const value = data.durationInMillis;
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Неожиданный формат ответа API.');
  return value;
}
export function historicInstance(value: unknown): HistoricInstance {
  const data = object(value);
  return { ...instance(value), startTime: date(data, 'startTime'), endTime: date(data, 'endTime'), durationInMillis: duration(data),
    deleteReason: text(data, 'deleteReason'), startUserId: text(data, 'startUserId') };
}
export function historicActivity(value: unknown): HistoricActivity {
  const data = object(value);
  return { id: identifier(data.id), activityId: text(data, 'activityId'), activityName: text(data, 'activityName'), activityType: text(data, 'activityType'),
    processInstanceId: identifier(data.processInstanceId), processDefinitionId: identifier(data.processDefinitionId), executionId: text(data, 'executionId'),
    taskId: text(data, 'taskId'), calledProcessInstanceId: text(data, 'calledProcessInstanceId'), assignee: text(data, 'assignee'),
    startTime: date(data, 'startTime'), endTime: date(data, 'endTime'), durationInMillis: duration(data) };
}
export function historyQuery(value: unknown): HistoryQuery {
  const data = object(value); const query: HistoryQuery = pageQuery(value);
  if (data.finished !== undefined && typeof data.finished !== 'boolean') throw new Error('Недопустимый статус экземпляра.');
  query.finished = data.finished as boolean | undefined;
  for (const key of ['startedAfter', 'startedBefore', 'finishedAfter', 'finishedBefore'] as const) {
    if (data[key] === undefined || data[key] === '') continue;
    const value = data[key];
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Недопустимый период истории.');
    query[key] = new Date(value).toISOString();
  }
  if (query.startedAfter && query.startedBefore && query.startedAfter > query.startedBefore || query.finishedAfter && query.finishedBefore && query.finishedAfter > query.finishedBefore) throw new Error('Недопустимый период истории.');
  return query;
}
