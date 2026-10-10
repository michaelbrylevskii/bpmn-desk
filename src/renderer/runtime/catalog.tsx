import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import type { DeadLetterJob, Definition, Instance, RuntimePage } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';

type CatalogPage = { kind: 'definitions'; page: RuntimePage<Definition> } | { kind: 'instances'; page: RuntimePage<Instance> } | { kind: 'jobs'; page: RuntimePage<DeadLetterJob> };
export function RuntimeCatalog({ connection, definition, instance, job }: { connection: string; definition: (item: Definition) => void; instance: (id: string) => void; job: (item: DeadLetterJob) => void }) {
  const { t, text } = useI18n(); const [kind, setKind] = useState<CatalogPage['kind']>('definitions');
  const [filter, setFilter] = useState<Definition>(); const [query, setQuery] = useState({ search: '', tenantId: '', start: 0 });
  const [search, setSearch] = useState(''); const [tenant, setTenant] = useState(''); const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<CatalogPage>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  useEffect(() => {
    let disposed = false; setResult(undefined); setError(''); setLoading(true);
    const read = async (): Promise<CatalogPage> => {
      const api = runtimeBridge(); const params = { ...query, tenantId: query.tenantId || undefined, definitionId: filter?.id };
      if (kind === 'definitions') return { kind, page: await api.definitions(connection, params) };
      if (kind === 'instances') return { kind, page: await api.instances(connection, params) };
      return { kind, page: await api.deadLetters(connection, params) };
    };
    void read().then(value => { if (!disposed) setResult(value); }).catch(error => { if (!disposed) setError(errorMessage(error)); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [connection, query, kind, filter, revision]);
  const switchKind = (value: CatalogPage['kind']) => { setKind(value); setSearch(''); setQuery(previous => ({ ...previous, search: '', start: 0 })); };
  const label = kind === 'definitions' ? t('Имя процесса') : kind === 'instances' ? t('Business key (точное совпадение)') : t('ID экземпляра (точное совпадение)');
  return <aside className="runtime-catalog">
    <nav className="runtime-tabs">{([{ kind: 'definitions', label: 'Процессы' }, { kind: 'instances', label: 'Экземпляры' }, { kind: 'jobs', label: 'Dead-letter jobs' }] as const).map(item =>
      <button key={item.kind} aria-pressed={kind === item.kind} onClick={() => switchKind(item.kind)}>{t(item.label)}</button>)}</nav>
    {kind !== 'definitions' && filter && <div className="runtime-filter"><span>{filter.name || filter.key} · v{filter.version}</span><button title={t('Все процессы')} onClick={() => { setFilter(undefined); setQuery(previous => ({ ...previous, start: 0 })); }}>×</button></div>}
    <form className="runtime-query" onSubmit={event => { event.preventDefault(); setQuery({ search, tenantId: tenant, start: 0 }); }}>
      <input aria-label={label} placeholder={label} value={search} onChange={event => setSearch(event.target.value)} />
      <input aria-label={t('Tenant ID')} placeholder={t('Tenant ID')} value={tenant} onChange={event => setTenant(event.target.value)} />
      <button className="icon-button" type="submit" title={t('Поиск')}><Search size={16} /></button><button className="icon-button" type="button" title={t('Обновить')} disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} /></button>
    </form>
    <div className="runtime-list" aria-busy={loading}>
      {loading && <p className="runtime-empty">{t('Загрузка состояния…')}</p>}{error && <p className="runtime-error" role="alert">{text(error)}</p>}
      {result?.kind === 'definitions' && result.page.data.map(item => <div className="runtime-row" key={item.id}>
        <button onClick={() => definition(item)}><strong>{item.name || item.key}</strong><small>{item.key} · v{item.version}{item.tenantId && ` · ${item.tenantId}`}</small><code>{item.id}</code></button>
        <button className="runtime-row-action" onClick={() => { setFilter(item); switchKind('instances'); }}>{t('Экземпляры')}</button></div>)}
      {result?.kind === 'instances' && result.page.data.map(item => <button className="runtime-row" key={item.id} onClick={() => instance(item.id)}><strong>{item.businessKey || item.name || item.id}</strong><small>{item.suspended ? t('Приостановлен') : t('Активен')}{item.tenantId && ` · ${item.tenantId}`}</small><code>{item.id}</code></button>)}
      {result?.kind === 'jobs' && result.page.data.map(item => <button className="runtime-row failed" key={item.id} onClick={() => job(item)}><strong>{item.elementName || item.elementId || item.id}</strong><small>{item.exceptionMessage || 'Dead-letter job'}</small><code>{item.processInstanceId || item.id}</code></button>)}
      {result && !result.page.data.length && <p className="runtime-empty">{t('Нет результатов')}</p>}
    </div>
    {result && <div className="runtime-pagination"><span>{t('Показано {count} из {total}', { count: result.page.data.length, total: result.page.total })}</span>
      <button className="icon-button" title={t('Предыдущая страница')} disabled={!query.start || loading} onClick={() => setQuery(previous => ({ ...previous, start: Math.max(0, previous.start - 25) }))}><ChevronLeft size={16} /></button>
      <button className="icon-button" title={t('Следующая страница')} disabled={loading || result.page.start + result.page.data.length >= result.page.total} onClick={() => setQuery(previous => ({ ...previous, start: previous.start + 25 }))}><ChevronRight size={16} /></button></div>}
  </aside>;
}
