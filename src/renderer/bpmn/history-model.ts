import type { HistoricActivity, HistorySnapshot } from '../../shared/history';
import { BPMN_URI as BPMN, elements, parseXml } from './xml';

export interface HistoryGroup { id: string; name: string; parent: string }
/** Структура BPMN, без привязки к UI или изменению XML. */
export function historyStructure(xml: string): { groups: HistoryGroup[]; parents: Map<string, string> } {
  const groups: HistoryGroup[] = []; const parents = new Map<string, string>();
  for (const element of elements(parseXml(xml))) {
    if (element.namespaceURI !== BPMN) continue;
    const id = element.getAttribute('id'); if (!id) continue;
    if (parents.has(id)) throw new Error('Повторяющийся BPMN ID.');
    let ancestor = element.parentNode; let parent = '';
    while (ancestor) {
      if (ancestor.nodeType === 1) {
        const node = ancestor as Element;
        if (node.namespaceURI === BPMN && ['subProcess', 'transaction', 'adHocSubProcess'].includes(node.localName)) { parent = node.getAttribute('id') || ''; break; }
      }
      ancestor = ancestor.parentNode;
    }
    parents.set(id, parent);
    if (['subProcess', 'transaction', 'adHocSubProcess'].includes(element.localName)) groups.push({ id, name: element.getAttribute('name') || id, parent });
  }
  return { groups, parents };
}
export function orderedActivities(activities: HistoricActivity[]): HistoricActivity[] {
  return [...activities].sort((a, b) => (Date.parse(a.startTime) || 0) - (Date.parse(b.startTime) || 0) || a.id.localeCompare(b.id));
}
export interface HistoryMark { id: string; marker: 'runtime-visited' | 'runtime-unfinished'; label: string; flow: boolean }
export function historyMarks(snapshot: HistorySnapshot): HistoryMark[] {
  const items = new Map<string, HistoricActivity[]>();
  for (const activity of snapshot.activities.data) {
    if (!activity.activityId) continue;
    const group = items.get(activity.activityId) ?? []; group.push(activity); items.set(activity.activityId, group);
  }
  return [...items].map(([id, visits]) => {
    const unfinished = visits.some(item => !item.endTime);
    const count = `${snapshot.activities.complete ? '' : '≥'}${visits.length}`;
    return { id, marker: unfinished ? 'runtime-unfinished' : 'runtime-visited',
      label: unfinished ? `… ${count}` : `✓ ${count}`, flow: visits.every(item => item.activityType === 'sequenceFlow') };
  });
}
