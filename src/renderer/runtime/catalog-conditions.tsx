import { Link2, X } from 'lucide-react';
import type { HistoryQuery } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { Tooltip } from '../ui/tooltip';
import { catalogConditions, defaultCatalogQuery, removeCatalogCondition, type DefinitionContext, type CatalogKind } from './catalog-query';

export function CatalogConditions({ kind, query, apply, definition }: { kind: CatalogKind; query: HistoryQuery; apply: (query: HistoryQuery) => void; definition?: DefinitionContext }) {
  const { t } = useI18n(); const items = catalogConditions(kind, query);
  if (!items.length) return null;
  return <div className="catalog-conditions" aria-label={t('Условия поиска')}>
    {items.map(item => {
      const preset = item.key === 'definitionId' && definition?.id === item.value ? definition : undefined;
      const label = preset ? `${t('Определение')}: ${preset.label}` : `${t(item.label)}${item.value ? `: ${item.value}` : ''}`;
      return <Tooltip key={item.key} content={<span>{label}{preset && <><br /><code>{preset.id}</code><br />{t('Общий для Runtime, History и Dead-letter jobs')}</>}</span>}>
        <button className={`catalog-condition${preset ? ' shared-context' : ''}`} aria-label={t('Убрать фильтр: {filter}', { filter: label })} onClick={() => apply(removeCatalogCondition(query, item.key))}>
          {preset && <Link2 size={12} aria-hidden="true" />}<span>{label}</span><X size={11} aria-hidden="true" />
        </button>
      </Tooltip>;
    })}
    <button className="runtime-link" onClick={() => apply(defaultCatalogQuery(kind))}>{t('Сбросить фильтры')}</button>
  </div>;
}
