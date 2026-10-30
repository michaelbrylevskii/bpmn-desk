import { Activity, Check, CircleAlert, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import { Tooltip } from '../ui/tooltip';
import type { useSummary } from './use-summary';

export function SummaryStatus({ summary, enabled, toggle, timeout }: { summary: ReturnType<typeof useSummary>; enabled: boolean; toggle: () => void; timeout: number }) {
  const { t, text, language } = useI18n(); const data = summary.data;
  const unmapped = data?.deadLetters.data.filter(job => !job.processInstanceId || !(job.elementId || data.executions.data.some(item => item.id === job.executionId && item.activityId))).length ?? 0;
  const failed = !!(summary.error || data?.executions.error || data?.deadLetters.error || data?.activities.error);
  const partial = !!data && (!data.executions.complete || !data.deadLetters.complete || !data.activities.complete || !!unmapped || data.executions.data.some(item => !item.processInstanceId) || data.activities.data.some(item => !item.processInstanceId));
  const status = !enabled ? 'off' : summary.busy ? 'loading' : failed ? 'error' : partial ? 'partial' : data ? 'ready' : 'idle';
  const statusLabel = t(!enabled ? 'Сводка выключена' : summary.busy ? 'Загрузка сводки…' : failed ? 'Ошибка сводки' : partial ? 'Частичная сводка' : data ? 'Сводка загружена' : 'Сводка не загружена');
  const content = <div className="summary-tooltip"><strong>{t('Сводка версии')} · {statusLabel}</strong>
    {enabled && <>
      {data && <><dl>{([{ label: 'Executions', sample: data.executions }, { label: 'Dead-letter jobs', sample: data.deadLetters }, { label: 'Записи истории', sample: data.activities }] as const).map(({ label, sample }) =>
        <div className="summary-source-count" key={label}><dt>{t(label)}</dt><dd>{sample.error ? '—' : `${sample.data.length}/${sample.total ?? '—'}`}</dd></div>)}</dl>
        <time dateTime={data.capturedAt}>{new Date(data.capturedAt).toLocaleString(language)}</time>
        {partial && <p className="summary-partial">{t('Частичная выборка: ≥ — не менее. Отсутствие метки не означает ноль.')}</p>}
        {summary.error && <p>{t('Последний снимок устарел.')}</p>}
        {!!unmapped && <p>{t('Не удалось разместить задания на схеме: {count}', { count: unmapped })}</p>}
      </>}
      {summary.error && <p className="summary-error">{text(summary.error)}</p>}
      {data && [data.executions, data.deadLetters, data.activities].flatMap((sample, i) => sample.error ? [<p key={i} className="summary-error">{t(i === 0 ? 'Executions' : i === 1 ? 'Dead-letter jobs' : 'Записи истории')}: {text(sample.error)}</p>] : [])}
      <p>{t('Обновление и повтор после ошибки — в верхней панели.')}</p>
      <small>{t('Три запроса, до 100 записей каждого вида, до {seconds} с.', { seconds: timeout })}</small>
    </>}
    <p>{t(enabled ? 'Нажми, чтобы выключить сводку для всех мониторов.' : 'Нажми, чтобы включить сводку для всех мониторов.')}</p>
  </div>;
  return <Tooltip content={content}><button className="icon-button runtime-summary-status" aria-label={t('Сводка версии')} aria-pressed={enabled} data-summary-state={status} onClick={toggle}>
    <Activity size={18} />{enabled && <span className={`summary-status-badge ${status}`} aria-label={statusLabel}>
      {summary.busy ? <LoaderCircle size={11} className="spinning" /> : failed ? <CircleAlert size={11} /> : partial ? <TriangleAlert size={11} /> : data ? <Check size={11} /> : null}
    </span>}</button></Tooltip>;
}
