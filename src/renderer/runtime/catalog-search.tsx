import { useEffect, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { HistoryQuery } from '../../shared/history';
import type { MessageKey } from '../../shared/i18n';
import { useI18n } from '../i18n/provider';
import { Select } from '../ui/select';
import type { CatalogKind } from './catalog-filters';

type Field = 'name' | 'key' | 'businessKey' | 'businessKeyLike' | 'instanceName' | 'instanceId' | 'executionId' | 'elementId';
const labels: Record<Field, MessageKey> = {
  name: 'Имя определения', key: 'Ключ определения', businessKey: 'Business key (точное совпадение)',
  businessKeyLike: 'Business key (содержит)', instanceName: 'Имя экземпляра', instanceId: 'ID экземпляра', executionId: 'ID execution', elementId: 'ID элемента',
};
function applied(kind: CatalogKind, query: HistoryQuery): { field: Field; value: string } {
  if (kind === 'definitions') return query.search ? { field: 'name', value: query.search } : { field: 'key', value: query.definitionKey || '' };
  if (kind === 'instances') return query.instanceName ? { field: 'instanceName', value: query.instanceName } : query.businessKeyLike ? { field: 'businessKeyLike', value: query.businessKeyLike } : { field: 'businessKey', value: query.search || '' };
  return query.executionId ? { field: 'executionId', value: query.executionId } : query.elementId ? { field: 'elementId', value: query.elementId } : { field: 'instanceId', value: query.instanceId || query.search || '' };
}
export function CatalogSearch({ kind, query, apply, busy, refresh, open }: {
  kind: CatalogKind; query: HistoryQuery; apply: (query: HistoryQuery) => void; busy: boolean; refresh: () => void; open: (id: string) => void;
}) {
  const { t } = useI18n();
  const initial = applied(kind, query);
  const [field, setField] = useState<Field>(kind === 'definitions' && !initial.value ? 'name' : initial.field);
  const [value, setValue] = useState(initial.value);
  useEffect(() => { const next = applied(kind, query); setValue(next.value); if (next.value) setField(next.field); }, [kind, query]);
  const fields: Field[] = kind === 'definitions' ? ['name', 'key'] : kind === 'instances' ? ['businessKey', 'businessKeyLike', 'instanceName', 'instanceId'] : ['instanceId', 'executionId', 'elementId'];
  const direct = kind === 'instances' && field === 'instanceId';
  const contains = field === 'name' || field === 'instanceName' || field === 'businessKeyLike';
  const action = t(direct ? 'Открыть экземпляр' : 'Поиск');
  return <form className="catalog-search" onSubmit={event => {
    event.preventDefault(); const term = value.trim();
    if (direct) { if (term) open(term); return; }
    const next: HistoryQuery = { ...query, search: undefined, instanceName: undefined, businessKeyLike: undefined, instanceId: undefined, start: 0 };
    if (kind === 'definitions') next.definitionKey = field === 'key' ? term || undefined : undefined;
    if (kind === 'jobs') { next.executionId = undefined; next.elementId = undefined; }
    if (field === 'name' || field === 'businessKey') next.search = term;
    else if (field !== 'key') next[field] = term || undefined;
    apply(next);
  }}>
    <Select label={t('Искать по')} value={field} onChange={value => setField(value as Field)} options={fields.map(value => ({ value, label: t(labels[value]) }))} />
    <div className="runtime-query"><input aria-label={t(labels[field])} placeholder={t(labels[field])} value={value} onChange={event => setValue(event.target.value)} />
      <button className="icon-button" type="submit" title={action} disabled={direct && !value.trim()}><Search size={16} /></button>
      <button className="icon-button" type="button" title={t('Обновить')} disabled={busy} onClick={refresh}><RefreshCw size={16} /></button></div>
    <small className="catalog-search-hint">{t(direct ? 'Открыть по ID без изменения списка' : contains ? 'По части строки · % и _ — шаблоны' : 'Точное совпадение')}</small>
  </form>;
}
