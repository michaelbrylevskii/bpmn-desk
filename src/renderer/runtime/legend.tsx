import { useI18n } from '../i18n/provider';
import { Tooltip } from '../ui/tooltip';

export function RuntimeLegend({ runtime, history, summary }: { runtime: boolean; history: boolean; summary: boolean }) {
  const { t } = useI18n();
  if (!runtime && !history && !summary) return null;
  const items = [
    ...runtime || summary ? [
      { style: 'active', label: runtime ? t('Текущие') : t('Экземпляры у элементов'), description: `${t(runtime ? '✓ — окончание зафиксировано; ● — текущие executions; ! — dead-letter jobs.' : 'Разные экземпляры у элемента, а не executions.')} ${t('Секции бейджа: история — серая, runtime — зелёная, ошибки — красная. Значения могут пересекаться и не складываются.')}` },
      { style: 'failed', label: 'Dead-letter', description: t(runtime ? 'Задания с ошибкой' : 'Экземпляры с dead-letter') },
    ] : [],
    ...summary ? [{ style: 'visited', label: t('История'), description: t('◷ — разные экземпляры с записью шага в выборке истории. Это не признак успешного завершения.') }] : [],
    ...history ? [
      { style: 'visited', label: t('Окончены'), description: `${t('Окончание зафиксировано')}. ${t('Метки истории не подтверждают успех или текущее состояние шага.')}` },
      { style: 'unfinished', label: t('Без окончания'), description: `${t('Окончание не зафиксировано')}. ${t('Метки истории не подтверждают успех или текущее состояние шага.')}` },
    ] : [],
  ];
  return <div className="runtime-legend" aria-label={t('Легенда')}>{items.map(item => <Tooltip key={item.style} content={item.description}>
    <span tabIndex={0} className={`runtime-legend-item ${item.style}`}>{item.label}</span>
  </Tooltip>)}</div>;
}
