import { Activity, Check, CircleAlert, LoaderCircle, TriangleAlert } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import { Tooltip } from '../ui/tooltip';
import type { useSummary } from './use-summary';

export function SummaryStatus({ summary, visible, toggle, active }: { summary: ReturnType<typeof useSummary>; visible: boolean; toggle: () => void; active: boolean }) {
  const { t, text, language } = useI18n(); const data = summary.data;
  const unmapped = data?.deadLetters.data.filter(job => !job.processInstanceId || !(job.elementId || data.executions.data.some(item => item.id === job.executionId && item.activityId))).length ?? 0;
  const failed = !!(summary.error || data?.executions.error || data?.deadLetters.error);
  const partial = !!data && (!data.executions.complete || !data.deadLetters.complete || !!unmapped || data.executions.data.some(item => !item.processInstanceId));
  const status = summary.busy ? 'loading' : failed ? 'error' : partial ? 'partial' : data ? 'ready' : 'idle';
  const statusLabel = t(summary.busy ? 'Загрузка сводки…' : failed ? 'Ошибка сводки' : partial ? 'Частичная сводка' : data ? 'Сводка загружена' : 'Сводка не загружена');
  const content = <div className="summary-tooltip"><strong>{t('Сводка версии')} · {statusLabel}</strong>
    {data && <><dl><dt>{t('Executions')}</dt><dd>{data.executions.error ? '—' : `${data.executions.data.length}/${data.executions.total ?? '—'}`}</dd>
      <dt>{t('Dead-letter jobs')}</dt><dd>{data.deadLetters.error ? '—' : `${data.deadLetters.data.length}/${data.deadLetters.total ?? '—'}`}</dd></dl>
      <time dateTime={data.capturedAt}>{new Date(data.capturedAt).toLocaleString(language)}</time>
      {partial && <p className="summary-partial">{t('Частичная выборка: ≥ — не менее. Отсутствие метки не означает ноль.')}</p>}
      {summary.error && <p>{t('Последний снимок устарел.')}</p>}
      {!!unmapped && <p>{t('Не удалось разместить задания на схеме: {count}', { count: unmapped })}</p>}
    </>}
    {summary.error && <p className="summary-error">{text(summary.error)}</p>}
    {data?.executions.error && <p className="summary-error">Executions: {text(data.executions.error)}</p>}
    {data?.deadLetters.error && <p className="summary-error">Dead-letter jobs: {text(data.deadLetters.error)}</p>}
    <p>{t(summary.error ? 'Нажми, чтобы повторить загрузку.' : data ? visible ? 'Нажми, чтобы скрыть метки. Обновление — в верхней панели.' : 'Нажми, чтобы показать метки. Обновление — в верхней панели.' : 'Нажми, чтобы загрузить сводку.')}</p>
    <small>{t('Два запроса, до 100 записей каждого вида, не дольше 8 секунд.')}</small>
  </div>;
  return <Tooltip content={content}><button className="icon-button runtime-summary-status" aria-label={t('Сводка версии')} aria-pressed={!!data && visible} aria-disabled={summary.busy || !active}
    data-summary-state={status} onClick={() => { if (!summary.busy && active) { if (!data || summary.error) { void summary.read(); if (!visible) toggle(); } else toggle(); } }}>
    <Activity size={18} /><span className={`summary-status-badge ${status}`} aria-label={statusLabel}>
      {summary.busy ? <LoaderCircle size={11} className="spinning" /> : failed ? <CircleAlert size={11} /> : partial ? <TriangleAlert size={11} /> : data ? <Check size={11} /> : null}
    </span></button></Tooltip>;
}
