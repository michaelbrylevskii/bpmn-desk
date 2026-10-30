import { RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { HistoryQuery } from '../../shared/history';
import type { Definition } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
import { Select } from '../ui/select';
import { CatalogConditions } from './catalog-conditions';
import { CatalogFields } from './catalog-fields';
import { catalogConditions, cleanCatalogQuery, defaultCatalogQuery, type CatalogKind } from './catalog-query';
import { HistoryFilters } from './history-filters';

export function CatalogFilters({ kind, query, apply, busy, refresh, open, definition }: {
  kind: CatalogKind; query: HistoryQuery; apply: (query: HistoryQuery) => void; busy: boolean; refresh: () => void; open: (id: string) => void; definition?: Definition;
}) {
  const { t, text } = useI18n(); const [draft, setDraft] = useState(query);
  const history = kind === 'history'; const defaultOrder = history ? 'desc' : 'asc';
  useEffect(() => { setDraft(query); }, [query]);
  const update = <K extends keyof HistoryQuery>(key: K, value: HistoryQuery[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const sorts = kind === 'definitions' ? ['key', 'name', 'version', 'id'] : history ? ['startTime', 'endTime', 'duration', 'processInstanceId', 'processDefinitionId', 'businessKey', 'tenantId'] : kind === 'runtime' ? ['id', 'processDefinitionId', 'processDefinitionKey', 'tenantId'] : ['id', 'processInstanceId', 'executionId', 'retries', 'dueDate'];
  const names: Record<string, string> = { id: 'ID', key: 'Ключ определения', name: 'Имя определения', version: 'Версия', processDefinitionId: 'ID определения', processDefinitionKey: 'Ключ определения', tenantId: 'Tenant ID', processInstanceId: 'ID экземпляра', executionId: 'ID execution', retries: 'Повторы', dueDate: 'Срок выполнения', startTime: 'Начат', endTime: 'Окончен', duration: 'Длительность', businessKey: 'Business key' };
  const count = catalogConditions(kind, query).length;
  return <><div className="catalog-controls"><details className="catalog-filters"><summary><SlidersHorizontal size={14} />{count ? t('Фильтры ({count})', { count }) : t('Фильтры')}</summary>
    <form onSubmit={event => { event.preventDefault(); apply(cleanCatalogQuery({ ...draft, sort: draft.sort || sorts[0], order: draft.order ?? defaultOrder })); }}>
      {kind === 'definitions' && <label className="runtime-check"><input type="checkbox" checked={draft.latest ?? true} onChange={event => update('latest', event.target.checked)} />{t('Только последние версии')}</label>}
      <CatalogFields kind={kind} query={draft} update={update} open={open} />
      {history && <><label>{t('Состояние')}<Select label={t('Состояние')} value={draft.finished === undefined ? '' : String(draft.finished)} onChange={value => update('finished', value === '' ? undefined : value === 'true')}
        options={[{ value: '', label: t('Любое состояние') }, { value: 'true', label: t('Завершён') }, { value: 'false', label: t('Не окончен по данным истории') }]} /></label><HistoryFilters query={draft} update={update} /></>}
      {kind === 'runtime' && <label>{t('Состояние')}<Select label={t('Состояние')} value={draft.suspended === undefined ? '' : String(draft.suspended)} onChange={value => update('suspended', value === '' ? undefined : value === 'true')}
        options={[{ value: '', label: t('Любое состояние') }, { value: 'false', label: t('Активен') }, { value: 'true', label: t('Приостановлен') }]} /></label>}
      <label>{t('Сортировать по')}<Select label={t('Сортировать по')} value={draft.sort || sorts[0]!} onChange={value => update('sort', value)} options={sorts.map(value => ({ value, label: text(names[value] ?? value) }))} /></label>
      <div className="filter-columns"><label>{t('Порядок')}<Select label={t('Порядок')} value={draft.order ?? defaultOrder} onChange={value => update('order', value as 'asc' | 'desc')} options={[{ value: 'asc', label: t('По возрастанию') }, { value: 'desc', label: t('По убыванию') }]} /></label>
        <label>{t('Размер страницы')}<Select label={t('Размер страницы')} value={String(draft.size ?? 25)} onChange={value => update('size', Number(value))} options={[10, 25, 50, 100].map(value => ({ value: String(value), label: String(value) }))} /></label></div>
      <div className="filter-actions"><button className="button small" type="submit">{t('Применить фильтры')}</button><button className="button small ghost" type="button" onClick={() => apply(defaultCatalogQuery(kind))}>{t('Сбросить фильтры')}</button></div>
    </form>
  </details><button className="icon-button catalog-refresh" type="button" title={t('Обновить')} disabled={busy} onClick={refresh}><RefreshCw size={15} /></button></div>
    <CatalogConditions kind={kind} query={query} apply={apply} definition={definition} />
  </>;
}
