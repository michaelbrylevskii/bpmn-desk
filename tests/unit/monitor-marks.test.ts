import { expect, it } from 'vitest';
import type { InstanceSnapshot } from '../../src/shared/runtime';
import type { HistorySnapshot, HistoricActivity } from '../../src/shared/history';
import { monitorMarks } from '../../src/renderer/bpmn/monitor-marks';
import { runtimeSvg } from '../../src/renderer/bpmn/runtime-export';

const instance = { id: 'p', name: '', businessKey: '', processDefinitionId: 'd', tenantId: '', suspended: false, startTime: '', superProcessInstanceId: '', processDefinitionName: '' };
const activity = (id: string, endTime = ''): HistoricActivity => ({ id, activityId: 'Review', activityName: '', activityType: 'userTask', processInstanceId: 'p', processDefinitionId: 'd', executionId: id, taskId: '', calledProcessInstanceId: '', assignee: '', startTime: '', endTime, durationInMillis: null });
const history: HistorySnapshot = { instance: { ...instance, endTime: '', durationInMillis: null, deleteReason: '', startUserId: '' }, activities: { data: [activity('a', '2026-10-01'), activity('b', '2026-10-02'), activity('c')], complete: true }, variables: { data: [], complete: true }, children: { data: [], complete: true }, capturedAt: '' };
const snapshot: InstanceSnapshot = { instance, executions: [{ id: 'e', parentId: 'p', activityId: 'Review', processInstanceId: 'p', suspended: false }], activeIds: ['Review'], tasks: [], variables: [], deadLetters: [], children: [], warnings: [], unavailable: [], capturedAt: '' };

it('совмещает повторы и текущую позицию одним зелёным маркером без изменения источников', () => {
  expect(monitorMarks(snapshot, undefined, history)).toEqual([{ id: 'Review', marker: 'runtime-active', label: '✓ 2 · ● 1', flow: false, sections: [{ kind: 'history', label: '✓ 2' }, { kind: 'runtime', label: '● 1' }] }]);
  expect(history.activities.data).toHaveLength(3); expect(snapshot.executions).toHaveLength(1);
  expect(monitorMarks(undefined, undefined, history)[0]?.marker).toBe('runtime-unfinished');
  expect(monitorMarks(snapshot)[0]?.label).toBe('● 1');
});

it('даёт приоритет dead-letter и обозначает неполный исторический счётчик', () => {
  const failed = { ...snapshot, deadLetters: [{ id: 'j', processInstanceId: 'p', processDefinitionId: 'd', executionId: 'e', elementId: 'Review', elementName: '', exceptionMessage: '', retries: 0, createTime: '', tenantId: '' }] };
  const marks = monitorMarks(failed, undefined, { ...history, activities: { ...history.activities, complete: false } });
  expect(marks).toEqual([{ id: 'Review', marker: 'runtime-failed', label: '✓ 2+ · ● 1 · ! 1', flow: false, sections: [{ kind: 'history', label: '✓ 2+' }, { kind: 'runtime', label: '● 1' }, { kind: 'failed', label: '! 1' }] }]);
  const svg = runtimeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g data-element-id="Review"><g class="djs-visual"><rect/></g></g></svg>', marks.map(mark => ({ ...mark, x: 100, y: 100 })));
  expect(svg.match(/data-runtime-badge="Review"/g)).toHaveLength(1); expect(svg).toContain('stroke="#b4233a"'); expect(svg).toContain('✓ 2+ · ● 1 · ! 1');
  expect(svg).toContain('fill="#626b79"'); expect(svg).toContain('fill="#207f67"'); expect(svg).toContain('fill="#b4233a"');
  expect(svg.match(/<polygon /g)).toHaveLength(2); expect(svg).toContain('clip-path="url(#desk-badge-clip-0)"');
});

it('не красит незавершённую историю зелёным без runtime-позиции', () => {
  expect(monitorMarks({ ...snapshot, activeIds: [], executions: [] }, undefined, history)[0]?.marker).toBe('runtime-unfinished');
});
