import { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DeadLetterJob, DefinitionSummary } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';

/** Переходы только по уже загруженной выборке: список не вызывает HTTP. */
export function SummaryDetails({ summary, element, open }: { summary: DefinitionSummary; element: string; open: (id: string, job?: DeadLetterJob) => void }) {
  const { t } = useI18n(); const [start, setStart] = useState(0);
  const instances = new Map<string, { id: string; job?: DeadLetterJob }>();
  const executions = new Map(summary.executions.data.map(item => [item.id, item.activityId]));
  for (const item of summary.executions.data) if (item.activityId === element && item.processInstanceId) instances.set(item.processInstanceId, { id: item.processInstanceId });
  for (const job of summary.deadLetters.data) if ((job.elementId || executions.get(job.executionId)) === element && job.processInstanceId) instances.set(job.processInstanceId, { id: job.processInstanceId, job });
  const items = [...instances.values()];
  const offset = Math.min(start, Math.max(0, Math.ceil(items.length / 10) * 10 - 10));
  const visible = items.slice(offset, offset + 10);
  return <aside className="runtime-details runtime-summary-details">
    <div className="runtime-instance"><strong>{t('Выбранный элемент')}</strong><code>{element}</code><p>{t('Экземпляры из загруженной выборки. Для подробностей выбери экземпляр.')}</p></div>
    <div className="runtime-detail-body">
      {!items.length && <p className="runtime-empty">{t('В загруженной выборке нет экземпляров этого элемента.')}</p>}
      {visible.map(item => <button className={`related-instance ${item.job ? 'failed' : ''}`} key={item.id} aria-label={`${t('Открыть экземпляр')}: ${item.id}`} onClick={() => open(item.id, item.job)}>
        <ArrowUpRight size={15} /><span><code>{item.id}</code><strong>{item.job ? t('Dead-letter jobs') : t('Executions')}</strong></span></button>)}
    </div>
    {!!items.length && <div className="runtime-pagination"><span>{t('Показано {count} из {total}', { count: visible.length, total: items.length })}</span>
      <button className="icon-button" title={t('Предыдущая страница')} disabled={!offset} onClick={() => setStart(offset - 10)}><ChevronLeft size={16} /></button>
      <button className="icon-button" title={t('Следующая страница')} disabled={offset + visible.length >= items.length} onClick={() => setStart(offset + 10)}><ChevronRight size={16} /></button></div>}
  </aside>;
}
