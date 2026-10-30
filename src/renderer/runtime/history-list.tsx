import type { Instance } from '../../shared/runtime';
import { useMemo, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import type { HistorySnapshot } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { historyStructure, orderedActivities } from '../bpmn/history-model';
import { HistoryActivity } from './history-activity';

export function HistoryList({ snapshot, xml, filter, clearFilter, focus, openInstance }: {
  snapshot: HistorySnapshot; xml?: string; filter: string; clearFilter: () => void; focus: (id: string) => void; openInstance: (id: string, preview?: Instance) => void;
}) {
  const { t, text } = useI18n(); const [search, setSearch] = useState(''); const [flows, setFlows] = useState(false); const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const activities = useMemo(() => orderedActivities(snapshot.activities.data), [snapshot.activities.data]);
  const structure = useMemo(() => { try { return historyStructure(xml || ''); } catch { return { groups: [], parents: new Map<string, string>() }; } }, [xml]);
  const counts = new Map<string, number>(); const visits = new Map<string, number>();
  const indices = new Map<string, number>();
  for (const item of activities) { const count = (counts.get(item.activityId) ?? 0) + 1; counts.set(item.activityId, count); indices.set(item.id, count); }
  const matching = activities.filter(item => (!filter || item.activityId === filter) && (flows || item.activityType !== 'sequenceFlow' || item.activityId === filter)
    && [item.activityName, item.activityId, item.assignee, item.activityType, item.executionId].some(value => value.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  const groupIds = new Set(structure.groups.map(group => group.id));
  const parentOf = (id: string) => groupIds.has(id) ? id : structure.parents.get(id) || '';
  for (const item of matching) visits.set(parentOf(item.activityId), (visits.get(parentOf(item.activityId)) ?? 0) + 1);
  const groupVisible = (id: string): boolean => visits.has(id) || structure.groups.some(group => group.parent === id && groupVisible(group.id));
  const within = (element: string, group: string): boolean => {
    for (let parent = parentOf(element); parent; parent = structure.parents.get(parent) || '') if (parent === group) return true;
    return false;
  };
  const render = (parent: string): ReactNode => {
    const rows = matching.filter(item => parentOf(item.activityId) === parent);
    const groups = structure.groups.filter(group => group.parent === parent && groupVisible(group.id));
    const entries = [
      ...rows.map(item => ({ key: item.id, time: Date.parse(item.startTime) || 0, content: <HistoryActivity key={item.id} activity={item} child={snapshot.children.data.find(child => child.id === item.calledProcessInstanceId)} index={indices.get(item.id) ?? 1} count={counts.get(item.activityId) ?? 1} complete={snapshot.activities.complete}
        selected={expanded.has(item.id)} choose={() => { setExpanded(previous => { const next = new Set(previous); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); focus(item.activityId); }} openInstance={openInstance} /> })),
      ...groups.map(group => ({ key: group.id, time: Math.min(...activities.filter(item => within(item.activityId, group.id)).map(item => Date.parse(item.startTime) || 0)),
        content: <details className="history-group" key={group.id} open><summary>{group.name}<code>{group.id}</code></summary>{render(group.id)}</details> })),
    ];
    return entries.sort((a, b) => a.time - b.time || a.key.localeCompare(b.key)).map(item => item.content);
  };
  return <div className="history-journal">
    <div className="history-list-controls"><input aria-label={t('Поиск по истории')} placeholder={t('Имя, элемент или исполнитель')} value={search} onChange={event => setSearch(event.target.value)} />
      <label className="runtime-check"><input type="checkbox" checked={flows} onChange={event => setFlows(event.target.checked)} />{t('Показывать переходы')}</label>
      {filter && <div className="history-element-filter"><span>{t('Выбранный элемент')}: <code>{filter}</code></span><button className="icon-button" title={t('Показать все шаги')} onClick={clearFilter}><X size={14} /></button></div>}
      <small>{t('Загружено записей: {count} из {total}', { count: snapshot.activities.data.length, total: snapshot.activities.total ?? '—' })}</small>
    </div>
    {snapshot.activities.error && <p className="runtime-error" role="alert">{text(snapshot.activities.error)}</p>}
    {!snapshot.activities.complete && <p className="runtime-warning">{t('История загружена частично. Метки и количество проходов относятся к загруженным записям.')}</p>}
    {!snapshot.activities.data.length && !snapshot.activities.error && <p className="runtime-warning">{t('Нет записей шагов. История могла быть отключена или очищена; это не означает, что процесс не выполнялся.')}</p>}
    {!!snapshot.activities.data.length && !activities.some(item => item.activityType === 'sequenceFlow') && <p className="history-note">{t('В загруженной истории нет записей переходов. Стрелки маршрута не восстанавливаются по узлам.')}</p>}
    <p className="history-note">{t('Время начала не задаёт строгий порядок параллельных шагов. Группы соответствуют структуре BPMN.')}</p>
    {render('')}
    {!!activities.length && !matching.length && <p className="runtime-empty">{t('Нет результатов')}</p>}
  </div>;
}
