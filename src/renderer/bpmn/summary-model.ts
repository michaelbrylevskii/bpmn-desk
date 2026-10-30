import type { DeadLetterJob, DefinitionSummary } from '../../shared/runtime';
import { summaryBadges } from './runtime-badges';
import type { MonitorMark } from './monitor-marks';

export type SummarySource = 'runtime' | 'history';
export interface SummaryInstance { id: string; job?: DeadLetterJob }
/** Списки и счётчики используют ту же ограниченную выборку, без чтений на каждый экземпляр. */
export function summaryInstances(summary: DefinitionSummary, element: string, source: SummarySource): SummaryInstance[] {
  const instances = new Map<string, SummaryInstance>();
  if (source === 'history') {
    for (const item of summary.activities.data) if (item.activityId === element && item.processInstanceId) instances.set(item.processInstanceId, { id: item.processInstanceId });
  } else {
    const executions = new Map(summary.executions.data.map(item => [item.id, item.activityId]));
    for (const item of summary.executions.data) if (item.activityId === element && item.processInstanceId) instances.set(item.processInstanceId, { id: item.processInstanceId });
    for (const job of summary.deadLetters.data) if ((job.elementId || executions.get(job.executionId)) === element && job.processInstanceId) instances.set(job.processInstanceId, { id: job.processInstanceId, job });
  }
  return [...instances.values()];
}
export function definitionMarks(summary: DefinitionSummary): MonitorMark[] {
  const marks = new Map<string, MonitorMark>();
  const ids = new Set(summary.activities.data.filter(item => item.activityId && item.processInstanceId).map(item => item.activityId));
  const partial = !summary.activities.complete || summary.activities.data.some(item => !item.processInstanceId);
  for (const id of ids) marks.set(id, { id, marker: 'runtime-visited', flow: summary.activities.data.some(item => item.activityId === id && item.activityType === 'sequenceFlow'), label: `◷ ${partial ? '≥' : ''}${summaryInstances(summary, id, 'history').length}` });
  for (const badge of summaryBadges(summary)) {
    const history = marks.get(badge.id);
    marks.set(badge.id, { id: badge.id, marker: badge.failed ? 'runtime-failed' : 'runtime-active', flow: false, label: `${badge.label}${history ? ` · ${history.label}` : ''}` });
  }
  return [...marks.values()];
}
