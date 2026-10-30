import { ArrowUpRight } from 'lucide-react';
import type { HistoryQuery } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { catalogFieldLabels, instanceCatalog, type CatalogKind } from './catalog-query';

type TextField = keyof typeof catalogFieldLabels | 'search';
export function CatalogFields({ kind, query, update, open }: { kind: CatalogKind; query: HistoryQuery; update: (key: TextField, value: string) => void; open: (id: string) => void }) {
  const { t } = useI18n();
  const fields: TextField[] = kind === 'definitions' ? ['search', 'definitionKey', 'tenantId'] : instanceCatalog(kind) ?
    ['search', 'businessKeyLike', 'instanceName', 'instanceId', 'definitionKey', 'definitionId', 'tenantId'] : ['instanceId', 'executionId', 'elementId', 'definitionId', 'tenantId'];
  return <>{fields.map(key => {
    const label = t(key === 'search' ? kind === 'definitions' ? 'Имя определения' : 'Business key (точное совпадение)' : catalogFieldLabels[key]);
    const value = query[key] ?? '';
    const direct = key === 'instanceId' && instanceCatalog(kind);
    const contains = key === 'businessKeyLike' || key === 'instanceName' || kind === 'definitions' && key === 'search';
    return <div key={key} className={direct ? 'catalog-id-field' : undefined}>
      <label>{label}<input value={value} title={t(contains ? 'По части строки · % и _ — шаблоны' : 'Точное совпадение')} onChange={event => update(key, event.target.value)} /></label>
      {direct && <button className="icon-button" type="button" aria-label={t('Открыть экземпляр')} title={t('Открыть по ID без изменения списка')} disabled={!value.trim()} onClick={() => open(value.trim())}><ArrowUpRight size={16} /></button>}
    </div>;
  })}</>;
}
