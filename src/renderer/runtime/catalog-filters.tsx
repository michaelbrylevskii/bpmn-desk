import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PageQuery } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
import { Select } from '../ui/select';
export type CatalogKind = 'definitions' | 'instances' | 'jobs';
export function CatalogFilters({ kind, query, apply }: { kind: CatalogKind; query: PageQuery; apply: (query: PageQuery) => void }) {
  const { t, text } = useI18n(); const [draft, setDraft] = useState(query);
  useEffect(() => { setDraft(query); }, [query]);
  const update = <K extends keyof PageQuery>(key: K, value: PageQuery[K]) => setDraft(previous => ({ ...previous, [key]: value }));
  const sorts = kind === 'definitions' ? ['key', 'name', 'version', 'id'] : kind === 'instances' ? ['id', 'processDefinitionId', 'processDefinitionKey', 'tenantId'] : ['id', 'processInstanceId', 'executionId', 'retries', 'dueDate'];
  const names: Record<string, string> = { id: 'ID', key: 'Ключ процесса', name: 'Имя процесса', version: 'Версия', processDefinitionId: 'ID определения', processDefinitionKey: 'Ключ процесса', tenantId: 'Tenant ID', processInstanceId: 'ID экземпляра', executionId: 'ID execution', retries: 'Повторы', dueDate: 'Срок выполнения' };
  return <details className="catalog-filters"><summary><SlidersHorizontal size={14} />{t('Фильтры')}</summary>
    <form onSubmit={event => { event.preventDefault(); apply({ ...draft, sort: draft.sort || sorts[0], order: draft.order ?? 'asc', start: 0 }); }}>
      {kind === 'definitions' && <label className="runtime-check"><input type="checkbox" checked={draft.latest ?? false} onChange={event => update('latest', event.target.checked)} />{t('Только последние версии')}</label>}
      <label>{t('Tenant ID')}<input value={draft.tenantId ?? ''} onChange={event => update('tenantId', event.target.value)} /></label>
      {kind !== 'jobs' && <label>{t('Ключ процесса')}<input value={draft.definitionKey ?? ''} onChange={event => update('definitionKey', event.target.value)} /></label>}
      {kind === 'instances' && <label>{t('Состояние')}<Select label={t('Состояние')} value={draft.suspended === undefined ? '' : String(draft.suspended)} onChange={value => update('suspended', value === '' ? undefined : value === 'true')}
        options={[{ value: '', label: t('Любое состояние') }, { value: 'false', label: t('Активен') }, { value: 'true', label: t('Приостановлен') }]} /></label>}
      {kind === 'jobs' && <><label>{t('ID execution')}<input value={draft.executionId ?? ''} onChange={event => update('executionId', event.target.value)} /></label>
        <label>{t('ID элемента')}<input value={draft.elementId ?? ''} onChange={event => update('elementId', event.target.value)} /></label></>}
      <label>{t('Сортировать по')}<Select label={t('Сортировать по')} value={draft.sort || sorts[0]!} onChange={value => update('sort', value)} options={sorts.map(value => ({ value, label: text(names[value] ?? value) }))} /></label>
      <div className="filter-columns"><label>{t('Порядок')}<Select label={t('Порядок')} value={draft.order ?? 'asc'} onChange={value => update('order', value as 'asc' | 'desc')} options={[{ value: 'asc', label: t('По возрастанию') }, { value: 'desc', label: t('По убыванию') }]} /></label>
        <label>{t('Размер страницы')}<Select label={t('Размер страницы')} value={String(draft.size ?? 25)} onChange={value => update('size', Number(value))} options={[10, 25, 50, 100].map(value => ({ value: String(value), label: String(value) }))} /></label></div>
      <div className="filter-actions"><button className="button small" type="submit">{t('Применить фильтры')}</button><button className="button small ghost" type="button" onClick={() => { const next = { search: query.search, start: 0, size: 25 }; setDraft(next); apply(next); }}>{t('Сбросить фильтры')}</button></div>
    </form>
  </details>;
}
