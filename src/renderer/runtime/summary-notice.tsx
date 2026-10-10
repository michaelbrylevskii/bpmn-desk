import type { DefinitionSummary } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';

export function SummaryNotice({ summary }: { summary: DefinitionSummary }) {
  const { t, text } = useI18n();
  const unmapped = summary.deadLetters.data.filter(job => !job.processInstanceId || !(job.elementId || summary.executions.data.some(item => item.id === job.executionId && item.activityId))).length;
  const incomplete = !summary.executions.complete || !summary.deadLetters.complete || !!unmapped || summary.executions.data.some(item => !item.processInstanceId);
  return <div className="runtime-summary-notice" role="status">
    <p>{t('Сводка версии: executions {executions}; dead-letter jobs {jobs}.', {
      executions: summary.executions.error ? '—' : `${summary.executions.data.length}/${summary.executions.total}`,
      jobs: summary.deadLetters.error ? '—' : `${summary.deadLetters.data.length}/${summary.deadLetters.total}`,
    })} <time dateTime={summary.capturedAt}>{new Date(summary.capturedAt).toLocaleTimeString()}</time></p>
    <p>{t('Бейджи показывают разные экземпляры у элемента; красные — экземпляры с dead-letter. Это не признак выполнения прямо сейчас.')}</p>
    {incomplete && <p className="runtime-warning">{t('Сводка неполная: ≥ N означает не менее N экземпляров. Отсутствие метки не подтверждает отсутствие экземпляров или ошибок.')}</p>}
    {summary.executions.error && <p className="runtime-error">Executions: {text(summary.executions.error)}</p>}
    {summary.deadLetters.error && <p className="runtime-error">Dead-letter jobs: {text(summary.deadLetters.error)}</p>}
    {!!unmapped && <p className="runtime-warning">{t('Не удалось разместить задания на схеме: {count}', { count: unmapped })}</p>}
    <p>{t('Снимок собирается несколькими запросами и может измениться во время чтения.')}</p>
  </div>;
}
