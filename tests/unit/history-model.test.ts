import { expect, it } from 'vitest';
import type { HistoricActivity, HistorySnapshot } from '../../src/shared/history';
import { historyMarks, historyStructure, orderedActivities } from '../../src/renderer/bpmn/history-model';
import { historyDuration } from '../../src/renderer/runtime/history-format';
import { runtimeSvg } from '../../src/renderer/bpmn/runtime-export';

const activity = (id: string, activityId = 'Review', endTime = '2026-10-01T12:01:00Z'): HistoricActivity => ({ id, activityId, activityName: '', activityType: 'userTask', processInstanceId: 'p', processDefinitionId: 'd', executionId: id, taskId: '', calledProcessInstanceId: '', assignee: '', startTime: '2026-10-01T12:00:00Z', endTime, durationInMillis: endTime ? 60000 : null });

it('группирует по BPMN ID, сохраняет повторные выполнения и не достраивает стрелки', () => {
  const snapshot: HistorySnapshot = { instance: { id: 'p', name: '', businessKey: '', processDefinitionId: 'd', tenantId: '', suspended: false, startTime: '', endTime: '', superProcessInstanceId: '', processDefinitionName: '', deleteReason: '', startUserId: '', durationInMillis: null },
    activities: { data: [activity('a'), activity('b'), activity('c', 'Review', ''), { ...activity('f', 'Flow_1'), activityType: 'sequenceFlow' }], complete: false },
    children: { data: [], complete: true }, variables: { data: [], complete: true }, capturedAt: '' };
  expect(historyMarks(snapshot)).toEqual([
    { id: 'Review', marker: 'runtime-unfinished', label: '… ≥3', flow: false },
    { id: 'Flow_1', marker: 'runtime-visited', label: '✓ ≥1', flow: true },
  ]);
  expect(orderedActivities([activity('b'), activity('a')]).map(item => item.id)).toEqual(['a', 'b']);
  expect(snapshot.activities.data).toHaveLength(4);
});

it('находит вложенные подпроцессы по namespace URI, не захватывая extension XML', () => {
  const structure = historyStructure('<b:definitions xmlns:b="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:x="urn:custom"><b:process id="P"><b:subProcess id="S" name="Checks"><b:transaction id="T"><b:userTask id="Review"/></b:transaction></b:subProcess><b:extensionElements><x:subProcess id="Fake"/></b:extensionElements></b:process></b:definitions>');
  expect(structure.groups).toEqual([{ id: 'S', name: 'Checks', parent: '' }, { id: 'T', name: 'T', parent: 'S' }]);
  expect(structure.parents.get('Review')).toBe('T'); expect(structure.parents.has('Fake')).toBe(false);
});

it('экспортирует исторические стрелки без бейджей у начала координат', () => {
  const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 100 400 200"><g data-element-id="Flow_1"><g class="djs-visual"><defs/><path d="M 100 100 L 300 200" style="stroke: black; stroke-width: 2px; fill: none"/></g></g><g data-element-id="Review"><g class="djs-visual"><rect/></g></g></svg>';
  const result = runtimeSvg(source, [{ id: 'Flow_1', marker: 'runtime-visited', label: '', x: 0, y: 0, badge: false }, { id: 'Review', marker: 'runtime-unfinished', label: '… 2', x: 350, y: 200 }]);
  expect(result).toContain('stroke="#527bac"'); expect(result).toContain('data-runtime-badge="Review"'); expect(result).not.toContain('data-runtime-badge="Flow_1"'); expect(result).toContain('viewBox="76 76 448 248"');
  expect(result).not.toContain('stroke: black'); expect(result).not.toContain('stroke-width: 2px'); expect(result).toContain('fill: none');
});

it('отличает нулевую длительность от неизвестной и форматирует длительные ожидания', () => {
  expect(historyDuration(null, 'ru')).toBe('—'); expect(historyDuration(0, 'ru')).toBe('0 мс');
  expect(historyDuration(1234, 'en')).toBe('1.23 s'); expect(historyDuration(62000, 'ru')).toBe('1 мин 2 с');
  expect(historyDuration(90000000, 'en')).toBe('1 d 1 h');
});
