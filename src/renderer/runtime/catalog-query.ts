import type { HistoryQuery } from '../../shared/history';
import type { MessageKey } from '../../shared/i18n';

export type CatalogKind = 'definitions' | 'runtime' | 'history' | 'jobs';
export const instanceCatalog = (kind: CatalogKind) => kind === 'runtime' || kind === 'history';
export function defaultCatalogQuery(kind: CatalogKind): HistoryQuery {
  return { ...(kind === 'definitions' ? { latest: true } : {}), start: 0, size: 25, order: kind === 'history' ? 'desc' : 'asc' };
}
export const catalogFieldLabels = {
  definitionKey: 'Ключ определения', definitionId: 'ID определения', instanceName: 'Имя экземпляра', businessKeyLike: 'Business key (содержит)',
  instanceId: 'ID экземпляра', executionId: 'ID execution', elementId: 'ID элемента', tenantId: 'Tenant ID',
  startedAfter: 'Начат после', startedBefore: 'Начат до', finishedAfter: 'Окончен после', finishedBefore: 'Окончен до',
} satisfies Partial<Record<keyof HistoryQuery, MessageKey>>;
export interface CatalogCondition { key: keyof HistoryQuery; label: MessageKey; value?: string }
export function catalogConditions(kind: CatalogKind, query: HistoryQuery): CatalogCondition[] {
  const items: CatalogCondition[] = Object.entries(catalogFieldLabels).flatMap(([key, label]) => {
    const value = query[key as keyof HistoryQuery];
    return value ? [{ key: key as keyof HistoryQuery, label, value: String(value) }] : [];
  });
  if (query.search) items.unshift({ key: 'search', label: kind === 'definitions' ? 'Имя определения' : 'Business key (точное совпадение)', value: query.search });
  if (kind === 'definitions' && query.latest !== false) items.unshift({ key: 'latest', label: 'Только последние версии' });
  if (query.suspended !== undefined) items.push({ key: 'suspended', label: query.suspended ? 'Приостановлен' : 'Активен' });
  if (query.finished !== undefined) items.push({ key: 'finished', label: query.finished ? 'Завершён' : 'Не окончен по данным истории' });
  return items;
}
export function removeCatalogCondition(query: HistoryQuery, key: keyof HistoryQuery): HistoryQuery {
  return { ...query, [key]: key === 'latest' ? false : undefined, start: 0 };
}
/** Пустые поля не отправляются в API; все заполненные условия применяются совместно. */
export function cleanCatalogQuery(query: HistoryQuery): HistoryQuery {
  return Object.fromEntries(Object.entries({ ...query, start: 0 }).map(([key, value]) => [key, typeof value === 'string' ? value.trim() || undefined : value]));
}
