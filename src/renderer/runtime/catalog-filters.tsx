import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HistoryQuery } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { Select } from '../ui/select';
import { CatalogConditions, catalogConditions } from './catalog-conditions';
import { HistoryFilters } from './history-filters';
export type CatalogKind = 'definitions' | 'instances' | 'jobs';
export function CatalogFilters({ kind, query, apply, history = false }: { kind: CatalogKind; query: HistoryQuery; apply: (query: HistoryQuery) => void; history?: boolean }) {
  const { t, text } = useI18n(); const [draft, setDraft] = useState(query);
  const defaultOrder = history ? 'desc' : 'asc';
  useEffect(() => { setDraft(query); }, [query]);
  const update = <K extends keyof HistoryQuery>(key: K, value: HistoryQuery[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const sorts = kind === 'definitions' ? ['key', 'name', 'version', 'id'] : kind === 'instances' ? history ? ['startTime', 'endTime', 'duration', 'processInstanceId', 'processDefinitionId', 'businessKey', 'tenantId'] : ['id', 'processDefinitionId', 'processDefinitionKey', 'tenantId'] : ['id', 'processInstanceId', 'executionId', 'retries', 'dueDate'];
  const names: Record<string, string> = { id: 'ID', key: 'Ключ определения', name: 'Имя определения', version: 'Версия', processDefinitionId: 'ID определения', processDefinitionKey: 'Ключ определения', tenantId: 'Tenant ID', processInstanceId: 'ID экземпляра', executionId: 'ID execution', retries: 'Повторы', dueDate: 'Срок выполнения', startTime: 'Начат', endTime: 'Окончен', duration: 'Длительность', businessKey: 'Business key' };
  const reset = () => apply({ latest: kind === 'definitions' ? true : undefined, start: 0, size: 25, order: defaultOrder });
  const count = catalogConditions(kind, query).length - (kind === 'definitions' ? 1 : 0);
  return <><CatalogConditions kind={kind} query={query} reset={reset} /><details className="catalog-filters"><summary><SlidersHorizontal size={14} />{count ? t('Фильтры ({count})', { count }) : t('Фильтры')}</summary>
    <form onSubmit={event => { event.preventDefault(); apply({ ...draft, sort: draft.sort || sorts[0], order: draft.order ?? defaultOrder, start: 0 }); }}>
      {kind === 'definitions' && <label className="runtime-check"><input type="checkbox" checked={draft.latest ?? true} onChange={event => update('latest', event.target.checked)} />{t('Только последние версии')}</label>}
      <label>{t('Tenant ID')}<input value={draft.tenantId ?? ''} onChange={event => update('tenantId', event.target.value)} /></label>
      {kind === 'instances' && <label>{t('Ключ определения')}<input value={draft.definitionKey ?? ''} onChange={event => update('definitionKey', event.target.value)} /></label>}
      {kind === 'instances' && history && <HistoryFilters query={draft} update={update} />}
      {kind === 'instances' && !history && <label>{t('Состояние')}<Select label={t('Состояние')} value={draft.suspended === undefined ? '' : String(draft.suspended)} onChange={value => update('suspended', value === '' ? undefined : value === 'true')}
        options={[{ value: '', label: t('Любое состояние') }, { value: 'false', label: t('Активен') }, { value: 'true', label: t('Приостановлен') }]} /></label>}
      <label>{t('Сортировать по')}<Select label={t('Сортировать по')} value={draft.sort || sorts[0]!} onChange={value => update('sort', value)} options={sorts.map(value => ({ value, label: text(names[value] ?? value) }))} /></label>
      <div className="filter-columns"><label>{t('Порядок')}<Select label={t('Порядок')} value={draft.order ?? defaultOrder} onChange={value => update('order', value as 'asc' | 'desc')} options={[{ value: 'asc', label: t('По возрастанию') }, { value: 'desc', label: t('По убыванию') }]} /></label>
        <label>{t('Размер страницы')}<Select label={t('Размер страницы')} value={String(draft.size ?? 25)} onChange={value => update('size', Number(value))} options={[10, 25, 50, 100].map(value => ({ value: String(value), label: String(value) }))} /></label></div>
      <div className="filter-actions"><button className="button small" type="submit">{t('Применить фильтры')}</button><button className="button small ghost" type="button" onClick={reset}>{t('Сбросить фильтры')}</button></div>
    </form>
  </details></>;
}
