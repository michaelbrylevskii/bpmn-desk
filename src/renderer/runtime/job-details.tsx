import { useEffect, useState } from 'react';
import type { DeadLetterJob } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';

export function JobDetails({ connection, job, focus }: { connection: string; job: DeadLetterJob; focus: (id: string) => void }) {
  const { t, text } = useI18n(); const [expanded, setExpanded] = useState(false); const [trace, setTrace] = useState(''); const [error, setError] = useState('');
  useEffect(() => {
    if (!expanded) return;
    let disposed = false;
    void runtimeBridge().stacktrace(connection, job.id).then(value => { if (!disposed) setTrace(value); }).catch(error => { if (!disposed) setError(errorMessage(error)); });
    return () => { disposed = true; };
  }, [connection, job.id, expanded]);
  return <article className="runtime-job">
    <button className="runtime-link" onClick={() => focus(job.elementId)}>{job.elementName || job.elementId || job.id}</button>
    <code>{job.id}</code><p className="runtime-error">{job.exceptionMessage || 'Dead-letter job'}</p>
    <dl><dt>{t('Повторы')}</dt><dd>{job.retries}</dd><dt>Execution</dt><dd>{job.executionId || '—'}</dd><dt>Instance</dt><dd>{job.processInstanceId || '—'}</dd>
      <dt>{t('Создано')}</dt><dd>{job.createTime ? new Date(job.createTime).toLocaleString() : '—'}</dd></dl>
    <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)}><summary>{t('Технические подробности ошибки')}</summary>
      {error ? <p role="alert" className="runtime-error">{text(error)}</p> : <pre>{trace || t('Загрузка состояния…')}</pre>}</details>
  </article>;
}
