import type { HistoryQuery } from '../../shared/history';
import type { MessageKey } from '../../shared/i18n';
import { useI18n } from '../i18n/provider';
import { Tooltip } from '../ui/tooltip';
import type { CatalogKind } from './catalog-filters';

const labels: Partial<Record<keyof HistoryQuery, MessageKey>> = {
  search: 'Поиск', definitionKey: 'Ключ определения', instanceName: 'Имя экземпляра', businessKeyLike: 'Business key (содержит)',
  instanceId: 'ID экземпляра', executionId: 'ID execution', elementId: 'ID элемента', tenantId: 'Tenant ID',
  startedAfter: 'Начат после', startedBefore: 'Начат до', finishedAfter: 'Окончен после', finishedBefore: 'Окончен до',
};
export function catalogConditions(kind: CatalogKind, query: HistoryQuery): { label: MessageKey; value?: string }[] {
  const items = Object.entries(labels).flatMap(([key, label]) => {
    const value = query[key as keyof HistoryQuery];
    return value && label ? [{ label: key === 'search' ? kind === 'definitions' ? 'Имя определения' as const : 'Business key (точное совпадение)' as const : label, value: String(value) }] : [];
  });
  if (kind === 'definitions') items.unshift({ label: query.latest === false ? 'Все версии' : 'Только последние версии', value: '' });
  if (query.suspended !== undefined) items.push({ label: query.suspended ? 'Приостановлен' : 'Активен', value: '' });
  if (query.finished !== undefined) items.push({ label: query.finished ? 'Завершён' : 'Не окончен по данным истории', value: '' });
  return items;
}
export function CatalogConditions({ kind, query, reset }: { kind: CatalogKind; query: HistoryQuery; reset: () => void }) {
  const { t } = useI18n(); const items = catalogConditions(kind, query);
  const changed = items.length > (kind === 'definitions' && query.latest !== false ? 1 : 0) || !!query.sort || !!query.start || query.size !== undefined && query.size !== 25;
  return <div className="catalog-conditions" aria-label={t('Условия поиска')}>
    {items.map(item => <Tooltip key={item.label} content={<span>{t(item.label)}{item.value && `: ${item.value}`}</span>}><span tabIndex={0} className="catalog-condition">{t(item.label)}{item.value && `: ${item.value}`}</span></Tooltip>)}
    {changed && <button className="runtime-link" onClick={reset}>{t('Сбросить фильтры')}</button>}
  </div>;
}
