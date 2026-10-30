import { sampleCount } from './sample-count';
import type { DefinitionSummary, InstanceSnapshot } from '../../shared/runtime';

export interface RuntimeBadge { id: string; failed: boolean; label: string }

export function instanceBadges(snapshot: InstanceSnapshot): RuntimeBadge[] {
  const counts = new Map<string, number>(); const failed = new Map<string, number>();
  const parents = new Set(snapshot.executions.map(item => item.parentId).filter(Boolean));
  for (const execution of snapshot.executions) if (execution.activityId && !parents.has(execution.id)) counts.set(execution.activityId, (counts.get(execution.activityId) ?? 0) + 1);
  for (const job of snapshot.deadLetters) {
    const id = job.elementId || snapshot.executions.find(item => item.id === job.executionId)?.activityId;
    if (id) failed.set(id, (failed.get(id) ?? 0) + 1);
  }
  return [...new Set([...snapshot.activeIds, ...failed.keys()])].map(id => ({ id, failed: failed.has(id),
    label: failed.has(id) ? `! ${failed.get(id)}` : counts.has(id) ? String(counts.get(id)) : '' }));
}

/** У версии считаются разные экземпляры у элемента, а не executions. Пустой ID не считается экземпляром. */
export function summaryBadges(summary: DefinitionSummary): RuntimeBadge[] {
  const active = new Map<string, Set<string>>(); const failed = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, element: string, instance: string) => {
    if (!element || !instance) return;
    const ids = map.get(element) ?? new Set<string>(); ids.add(instance); map.set(element, ids);
  };
  for (const item of summary.executions.data) add(active, item.activityId, item.processInstanceId);
  const executions = new Map(summary.executions.data.map(item => [item.id, item.activityId]));
  let incompleteJobs = !summary.deadLetters.complete;
  for (const job of summary.deadLetters.data) {
    const element = job.elementId || executions.get(job.executionId) || '';
    if (!element || !job.processInstanceId) incompleteJobs = true;
    add(failed, element, job.processInstanceId);
  }
  const incompleteExecutions = !summary.executions.complete || summary.executions.data.some(item => !item.processInstanceId);
  const count = (value: number, incomplete: boolean) => sampleCount(value, !incomplete);
  return [...new Set([...active.keys(), ...failed.keys()])].map(id => ({ id, failed: failed.has(id),
    label: failed.has(id) ? `! ${count(failed.get(id)!.size, incompleteJobs)}` : count(active.get(id)!.size, incompleteExecutions) }));
}
