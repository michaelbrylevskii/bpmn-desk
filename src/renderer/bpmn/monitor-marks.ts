import { badgeLabel, type BadgeSection } from './badge-sections';
import { sampleCount } from './sample-count';
import type { DefinitionSummary, InstanceSnapshot } from '../../shared/runtime';
import type { HistorySnapshot } from '../../shared/history';
import { definitionMarks } from './summary-model';
import { historyMarks } from './history-model';
import { instanceBadges, summaryBadges } from './runtime-badges';
import type { RuntimeMark } from './runtime-export';

export interface MonitorMark { id: string; marker: RuntimeMark['marker']; label: string; flow: boolean; sections?: BadgeSection[] }
/** Один маркер и один бейдж на BPMN ID. Runtime имеет приоритет над историей. */
export function monitorMarks(snapshot?: InstanceSnapshot, summary?: DefinitionSummary, history?: HistorySnapshot): MonitorMark[] {
  if (summary && !snapshot && !history) return definitionMarks(summary);
  const marks = new Map<string, MonitorMark>((history ? historyMarks(history) : []).map(mark => [mark.id, { ...mark, sections: [{ kind: mark.marker === 'runtime-unfinished' ? 'unfinished' : 'history', label: mark.label }] }]));
  const completed = new Map<string, number>();
  for (const activity of history?.activities.data ?? []) if (activity.endTime) completed.set(activity.activityId, (completed.get(activity.activityId) ?? 0) + 1);
  for (const badge of snapshot ? instanceBadges(snapshot) : summary ? summaryBadges(summary) : []) {
    const sections = [...badge.sections];
    if (snapshot && history) {
      const ended = completed.get(badge.id) ?? 0;
      if (ended) sections.unshift({ kind: 'history', label: `✓ ${sampleCount(ended, history.activities.complete)}` });
    }
    marks.set(badge.id, { id: badge.id, marker: badge.failed ? 'runtime-failed' : 'runtime-active', label: badgeLabel(sections), sections, flow: false });
  }
  return [...marks.values()];
}
