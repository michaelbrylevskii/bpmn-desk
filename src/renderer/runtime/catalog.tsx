import { useEffect, useMemo, useState, type SetStateAction } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DeadLetterJob, Definition, Instance, RuntimePage } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';
import { CatalogFilters } from './catalog-filters';
import type { HistoricInstance, HistoryQuery } from '../../shared/history';
import { defaultCatalogQuery, type CatalogKind } from './catalog-query';

type CatalogPage = { kind: 'definitions'; page: RuntimePage<Definition> } | { kind: 'runtime' | 'history'; page: RuntimePage<Instance | HistoricInstance> } | { kind: 'jobs'; page: RuntimePage<DeadLetterJob> };
export function RuntimeCatalog({ connection, revision: profileRevision, selectedInstance, selectedDefinition, instancesOf, definition, instance, job }: { connection: string; revision: number; selectedInstance: string; selectedDefinition: string; instancesOf?: { definition: Definition }; definition: (item: Definition) => void; instance: (id: string, history?: boolean, preview?: Instance) => void; job: (item: DeadLetterJob) => void }) {
  const { t, text } = useI18n(); const [kind, setKind] = useState<CatalogKind>('definitions');
  const [scope, setScope] = useState<Definition>();
  const [queries, setQueries] = useState<Partial<Record<CatalogKind, HistoryQuery>>>({});
  const history = kind === 'history';
  const query = useMemo(() => queries[kind] ?? defaultCatalogQuery(kind), [queries, kind]);
  const setQuery = (next: SetStateAction<HistoryQuery>) => setQueries(previous => ({ ...previous, [kind]: typeof next === 'function' ? next(previous[kind] ?? defaultCatalogQuery(kind)) : next }));
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!instancesOf) return;
    setScope(instancesOf.definition); setKind('runtime');
    setQueries(previous => ({ ...previous, ...Object.fromEntries((['runtime', 'history', 'jobs'] as const).map(key => [key, { ...previous[key] ?? defaultCatalogQuery(key), definitionId: instancesOf.definition.id, start: 0 }])) }));
  }, [instancesOf]);
  const requestKey = JSON.stringify({ connection, query, kind, profileRevision });
  const [response, setResponse] = useState<{ key: string; result: CatalogPage }>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const result = response?.key === requestKey ? response.result : undefined;
  const message = text(error); const timedOut = message.includes(t('Превышено время ожидания API.'));
  useEffect(() => {
    let disposed = false; setError(''); setLoading(true);
    const read = async (): Promise<CatalogPage> => {
      const api = runtimeBridge(); const params = { ...query, tenantId: query.tenantId || undefined };
      if (kind === 'definitions') return { kind, page: await api.definitions(connection, params) };
      if (kind === 'history') return { kind, page: await api.historicInstances(connection, params) };
      if (kind === 'runtime') return { kind, page: await api.instances(connection, params) };
      return { kind, page: await api.deadLetters(connection, params) };
    };
    void read().then(value => { if (!disposed) setResponse({ key: requestKey, result: value }); }).catch(error => { if (!disposed) setError(errorMessage(error)); }).finally(() => { if (!disposed) setLoading(false); });
    return () => { disposed = true; };
  }, [connection, query, kind, revision, profileRevision, requestKey]);
  return <aside className="runtime-catalog">
    <nav className="runtime-tabs catalog-tabs">{([{ kind: 'definitions', label: 'Определения' }, { kind: 'runtime', label: 'Текущее состояние' }, { kind: 'history', label: 'История' }, { kind: 'jobs', label: 'Dead-letter jobs' }] as const).map(item =>
      <button key={item.kind} aria-pressed={kind === item.kind} onClick={() => setKind(item.kind)}>{t(item.label)}</button>)}</nav>
    <CatalogFilters key={kind} kind={kind} query={query} apply={setQuery} busy={loading} refresh={() => setRevision(value => value + 1)} open={id => instance(id, history)} definition={scope} />
    <div className="runtime-list" aria-busy={loading}>
      {loading && <p className="runtime-empty" role="status">{t('Загрузка состояния…')}</p>}
      {error && <div className="runtime-error" role="alert"><p>{message}</p>{timedOut && <p>{t('Сервер считает общее количество вместе со страницей. Сузь фильтры или увеличь таймаут в настройках подключения.')}</p>}</div>}
      {result && (loading || error) && <p className="runtime-empty runtime-stale" role="status">{t('Показаны ранее загруженные данные.')}</p>}
      {result?.kind === 'definitions' && result.page.data.map(item => <button className="runtime-row" key={item.id} onClick={() => definition(item)} aria-current={selectedDefinition === item.id || undefined}>
        <strong>{item.name || item.key}</strong><small>{item.key} · v{item.version}{item.tenantId && ` · ${item.tenantId}`}</small><code>{item.id}</code></button>)}
      {(result?.kind === 'runtime' || result?.kind === 'history') && result.page.data.map(item => <button className="runtime-row" key={item.id} aria-current={selectedInstance === item.id || undefined} onClick={() => instance(item.id, history, item)}><strong>{item.businessKey || item.name || item.id}</strong><small className="runtime-row-definition">{item.processDefinitionName || item.processDefinitionId}</small>{item.tenantId && <small>{item.tenantId}</small>}<code>{item.id}</code>{item.startTime && <time dateTime={item.startTime}>{new Date(item.startTime).toLocaleString()}</time>}
        {'endTime' in item && <small>{t(item.deleteReason ? 'Прекращён' : item.endTime ? 'Завершён' : 'Не окончен по данным истории')}</small>}</button>)}
      {result?.kind === 'jobs' && result.page.data.map(item => <button className="runtime-row failed" key={item.id} onClick={() => job(item)}><strong>{item.elementName || item.elementId || item.id}</strong><small>{item.exceptionMessage || 'Dead-letter job'}</small><code>{item.processInstanceId || item.id}</code></button>)}
      {result && !result.page.data.length && <p className="runtime-empty">{t('Нет результатов')}</p>}
    </div>
    {result && <div className="runtime-pagination"><span>{t('Показано {count} из {total}', { count: result.page.data.length, total: result.page.total })}</span>
      <button className="icon-button" title={t('Предыдущая страница')} disabled={!query.start || loading} onClick={() => setQuery(previous => ({ ...previous, start: Math.max(0, (previous.start ?? 0) - (previous.size ?? 25)) }))}><ChevronLeft size={16} /></button>
      <button className="icon-button" title={t('Следующая страница')} disabled={loading || result.page.start + result.page.data.length >= result.page.total} onClick={() => setQuery(previous => ({ ...previous, start: (previous.start ?? 0) + (previous.size ?? 25) }))}><ChevronRight size={16} /></button></div>}
  </aside>;
}
