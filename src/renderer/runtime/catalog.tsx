import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import type { DeadLetterJob, Definition, Instance, RuntimePage } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';
import { CatalogFilters } from './catalog-filters';
import type { HistoricInstance, HistoryQuery } from '../../shared/history';
import { Select } from '../ui/select';

type CatalogPage = { kind: 'definitions'; page: RuntimePage<Definition> } | { kind: 'instances'; page: RuntimePage<Instance | HistoricInstance> } | { kind: 'jobs'; page: RuntimePage<DeadLetterJob> };
export function RuntimeCatalog({ connection, revision: profileRevision, selectedInstance, selectedDefinition, definition, instance, job }: { connection: string; revision: number; selectedInstance: string; selectedDefinition: string; definition: (item: Definition) => void; instance: (id: string, history?: boolean, preview?: Instance) => void; job: (item: DeadLetterJob) => void }) {
  const { t, text } = useI18n(); const [kind, setKind] = useState<CatalogPage['kind']>('definitions');
  const [filter, setFilter] = useState<Definition>(); const [query, setQuery] = useState<HistoryQuery>({ search: '', start: 0, size: 25 });
  const [instanceView, setInstanceView] = useState('current'); const history = instanceView !== 'current';
  const [search, setSearch] = useState(''); const [instanceInput, setInstanceInput] = useState(''); const [revision, setRevision] = useState(0);
  const requestKey = JSON.stringify({ connection, query, kind, instanceView, definitionId: filter?.id, profileRevision });
  const [response, setResponse] = useState<{ key: string; result: CatalogPage }>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const result = response?.key === requestKey ? response.result : undefined;
  const message = text(error); const timedOut = message.includes(t('Превышено время ожидания API.'));
  useEffect(() => {
    let disposed = false; setError(''); setLoading(true);
    const read = async (): Promise<CatalogPage> => {
      const api = runtimeBridge(); const params = { ...query, tenantId: query.tenantId || undefined, definitionId: filter?.id };
      if (kind === 'definitions') return { kind, page: await api.definitions(connection, params) };
      if (kind === 'instances') return { kind, page: history ? await api.historicInstances(connection, { ...params, finished: instanceView === 'completed' ? true : undefined }) : await api.instances(connection, params) };
      return { kind, page: await api.deadLetters(connection, params) };
    };
    void read().then(value => { if (!disposed) setResponse({ key: requestKey, result: value }); }).catch(error => { if (!disposed) setError(errorMessage(error)); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [connection, query, kind, filter, revision, profileRevision, requestKey, history, instanceView]);
  const switchKind = (value: CatalogPage['kind']) => { if (value === kind) return; setKind(value); setSearch(''); setQuery(previous => ({ search: '', start: 0, size: previous.size, tenantId: previous.tenantId })); };
  const label = kind === 'definitions' ? t('Имя процесса') : kind === 'instances' ? t('Business key (точное совпадение)') : t('ID экземпляра (точное совпадение)');
  return <aside className="runtime-catalog">
    <nav className="runtime-tabs">{([{ kind: 'definitions', label: 'Процессы' }, { kind: 'instances', label: 'Экземпляры' }, { kind: 'jobs', label: 'Dead-letter jobs' }] as const).map(item =>
      <button key={item.kind} aria-pressed={kind === item.kind} onClick={() => switchKind(item.kind)}>{t(item.label)}</button>)}</nav>
    {kind === 'instances' && <div className="history-catalog-mode"><Select label={t('Какие экземпляры показывать')} value={instanceView}
      onChange={value => { setInstanceView(value); setQuery(previous => ({ search: previous.search, tenantId: previous.tenantId, definitionKey: previous.definitionKey, start: 0, size: previous.size, order: value === 'current' ? 'asc' : 'desc' })); }}
      options={[{ value: 'current', label: t('Текущие экземпляры') }, { value: 'completed', label: t('Завершённые экземпляры') }, { value: 'all', label: t('Все экземпляры из истории') }]} /></div>}
    {kind !== 'definitions' && filter && <div className="runtime-filter"><span>{filter.name || filter.key} · v{filter.version}</span><button title={t('Все процессы')} onClick={() => { setFilter(undefined); setQuery(previous => ({ ...previous, start: 0 })); }}>×</button></div>}
    <form className="runtime-query" onSubmit={event => { event.preventDefault(); setQuery(previous => ({ ...previous, search, start: 0 })); }}>
      <input aria-label={label} placeholder={label} value={search} onChange={event => setSearch(event.target.value)} />
      <button className="icon-button" type="submit" title={t('Поиск')}><Search size={16} /></button><button className="icon-button" type="button" title={t('Обновить')} disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} /></button>
    </form>
    {kind === 'instances' && <form className="catalog-open-instance" onSubmit={event => { event.preventDefault(); if (instanceInput.trim()) instance(instanceInput.trim(), history); }}>
      <input aria-label={t('ID экземпляра')} placeholder={t('ID экземпляра')} value={instanceInput} onChange={event => setInstanceInput(event.target.value)} />
      <button className="icon-button" title={t('Открыть экземпляр')} disabled={!instanceInput.trim()}><Search size={15} /></button></form>}
    <CatalogFilters key={`${kind}:${instanceView}`} kind={kind} query={query} apply={setQuery} history={kind === 'instances' && history} />
    <div className="runtime-list" aria-busy={loading}>
      {loading && <p className="runtime-empty" role="status">{t('Загрузка состояния…')}</p>}
      {error && <div className="runtime-error" role="alert"><p>{message}</p>{timedOut && <p>{t('Сервер считает общее количество вместе со страницей. Сузь фильтры или увеличь таймаут в настройках подключения.')}</p>}</div>}
      {result && (loading || error) && <p className="runtime-empty runtime-stale" role="status">{t('Показаны ранее загруженные данные.')}</p>}
      {result?.kind === 'definitions' && result.page.data.map(item => <div className="runtime-row" key={item.id} aria-current={selectedDefinition === item.id || undefined}>
        <button onClick={() => definition(item)}><strong>{item.name || item.key}</strong><small>{item.key} · v{item.version}{item.tenantId && ` · ${item.tenantId}`}</small><code>{item.id}</code></button>
        <button className="runtime-row-action" onClick={() => { setFilter(item); switchKind('instances'); }}>{t('Экземпляры')}</button></div>)}
      {result?.kind === 'instances' && result.page.data.map(item => <button className="runtime-row" key={item.id} aria-current={selectedInstance === item.id || undefined} onClick={() => instance(item.id, history, item)}><strong>{item.businessKey || item.name || item.id}</strong><small className="runtime-row-definition">{item.processDefinitionName || item.processDefinitionId}</small>{item.tenantId && <small>{item.tenantId}</small>}<code>{item.id}</code>{item.startTime && <time dateTime={item.startTime}>{new Date(item.startTime).toLocaleString()}</time>}
        {'endTime' in item && <small>{t(item.deleteReason ? 'Прекращён' : item.endTime ? 'Завершён' : 'Не окончен по данным истории')}</small>}</button>)}
      {result?.kind === 'jobs' && result.page.data.map(item => <button className="runtime-row failed" key={item.id} onClick={() => job(item)}><strong>{item.elementName || item.elementId || item.id}</strong><small>{item.exceptionMessage || 'Dead-letter job'}</small><code>{item.processInstanceId || item.id}</code></button>)}
      {result && !result.page.data.length && <p className="runtime-empty">{t('Нет результатов')}</p>}
    </div>
    {result && <div className="runtime-pagination"><span>{t('Показано {count} из {total}', { count: result.page.data.length, total: result.page.total })}</span>
      <button className="icon-button" title={t('Предыдущая страница')} disabled={!query.start || loading} onClick={() => setQuery(previous => ({ ...previous, start: Math.max(0, (previous.start ?? 0) - (previous.size ?? 25)) }))}><ChevronLeft size={16} /></button>
      <button className="icon-button" title={t('Следующая страница')} disabled={loading || result.page.start + result.page.data.length >= result.page.total} onClick={() => setQuery(previous => ({ ...previous, start: (previous.start ?? 0) + (previous.size ?? 25) }))}><ChevronRight size={16} /></button></div>}
  </aside>;
}
