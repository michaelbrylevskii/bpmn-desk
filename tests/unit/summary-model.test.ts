import { expect, it } from 'vitest';
import type { DefinitionSummary } from '../../src/shared/runtime';
import type { HistoricActivity } from '../../src/shared/history';
import { definitionMarks, summaryInstances } from '../../src/renderer/bpmn/summary-model';
import { summaryPreference } from '../../src/renderer/runtime/use-summary-preference';
const activity = (id: string, instance: string): HistoricActivity => ({ id, processInstanceId: instance, activityId: 'Review', activityName: '', activityType: 'userTask', processDefinitionId: 'd1', executionId: '', taskId: '', calledProcessInstanceId: '', assignee: '', startTime: '', endTime: '', durationInMillis: null });
const state = (): DefinitionSummary => ({ executions: { data: [{ id: 'e', parentId: '', processInstanceId: 'p1', activityId: 'Review', suspended: false }], complete: true }, deadLetters: { data: [], complete: true }, activities: { data: [activity('a', 'p1'), activity('b', 'p1'), activity('c', 'p2')], complete: true }, capturedAt: '' });
it('разделяет текущую позицию и посещения, повторы одного экземпляра считает один раз', () => {
  const summary = state();
  expect(summaryInstances(summary, 'Review', 'runtime').map(item => item.id)).toEqual(['p1']);
  expect(summaryInstances(summary, 'Review', 'history').map(item => item.id)).toEqual(['p1', 'p2']);
  expect(definitionMarks(summary)).toEqual([{ id: 'Review', marker: 'runtime-active', flow: false, label: '1 · ◷ 2' }]);
  summary.executions.data = []; summary.activities.complete = false;
  expect(definitionMarks(summary)[0]).toMatchObject({ marker: 'runtime-visited', label: '◷ ≥2' });
});
it('сохраняет приоритет dead-letter и не считает записи без ID экземпляра', () => {
  const summary = state(); summary.activities.data.push(activity('d', ''));
  summary.deadLetters.data.push({ id: 'j', elementId: 'Review', processInstanceId: 'p1', executionId: 'e', processDefinitionId: 'd1', elementName: '', exceptionMessage: '', retries: 0, createTime: '', tenantId: '' });
  expect(definitionMarks(summary)[0]).toMatchObject({ marker: 'runtime-failed', label: '! 1 · ◷ ≥2' });
});
it('мигрирует явно выключенную сводку и сохраняет приоритет глобального значения', () => {
  expect(summaryPreference(null, false)).toBe(false); expect(summaryPreference(null)).toBe(true);
  expect(summaryPreference('true', false)).toBe(true); expect(summaryPreference('false', true)).toBe(false);
});
