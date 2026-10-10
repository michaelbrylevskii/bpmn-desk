import { useEffect, useState } from 'react';
import type { DeadLetterJob, InstanceSnapshot, Variable } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';
import { Variables } from './variables';
import { JobDetails } from './job-details';
import { InstanceRelationships } from './relationships';

export function InstanceDetails({ connection, snapshot, selected, focus, openInstance, jobSelection }: {
  connection: string; snapshot: InstanceSnapshot; selected: string; focus: (id: string) => void; openInstance: (id: string) => void;
  jobSelection?: DeadLetterJob;
}) {
  const { t, text } = useI18n(); const [tab, setTab] = useState<'variables' | 'executions' | 'jobs' | 'tasks'>(jobSelection ? 'jobs' : 'variables');
  useEffect(() => { if (jobSelection) setTab('jobs'); }, [jobSelection]);
  const [execution, setExecution] = useState(''); const [local, setLocal] = useState<Variable[]>(); const [error, setError] = useState('');
  useEffect(() => {
    if (!execution) return; let disposed = false; setLocal(undefined); setError('');
    void runtimeBridge().executionVariables(connection, execution).then(value => { if (!disposed) setLocal(value); }).catch(error => { if (!disposed) setError(errorMessage(error)); });
    return () => { disposed = true; };
  }, [connection, execution, snapshot.capturedAt]);
  const process = snapshot.instance;
  return <aside className="runtime-details">
    <div className="runtime-instance"><strong>{process.businessKey || process.name || process.id}</strong><code>{process.id}</code>
      <dl><dt>{t('Движок')}</dt><dd>Flowable</dd><dt>{t('Состояние')}</dt><dd>{process.suspended ? t('Приостановлен') : t('Активен')}</dd>
        <dt>Definition</dt><dd>{process.processDefinitionId}</dd><dt>Tenant</dt><dd>{process.tenantId || '—'}</dd>
        <dt>{t('Начат')}</dt><dd>{process.startTime ? new Date(process.startTime).toLocaleString() : '—'}</dd></dl>
      {!!snapshot.deadLetters.length && <p className="runtime-error">{t('Есть dead-letter jobs')}: {snapshot.deadLetters.length}</p>}
      <InstanceRelationships snapshot={snapshot} open={openInstance} />
      {selected && <p className="runtime-selection">{t('Выбранный элемент')}: <code>{selected}</code></p>}
    </div>
    <nav className="runtime-tabs">{([{ id: 'variables', label: 'Переменные процесса' }, { id: 'executions', label: 'Executions' }, { id: 'jobs', label: 'Dead-letter jobs' }, { id: 'tasks', label: 'Задачи' }] as const).map(item =>
      <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{t(item.label)}{item.id === 'jobs' && ` (${snapshot.deadLetters.length})`}</button>)}</nav>
    <div className="runtime-detail-body">
      {tab === 'variables' && <Variables variables={snapshot.variables} />}
      {tab === 'executions' && <>{snapshot.executions.map(item => <article className={`runtime-execution ${selected && item.activityId === selected ? 'selected' : ''}`} key={item.id}>
        <button className="runtime-link" onClick={() => focus(item.activityId)}>{item.activityId || 'Scope'}</button><code>{item.id}</code><small>Parent: {item.parentId || '—'}</small>
        <button className="button small" aria-pressed={execution === item.id} onClick={() => setExecution(item.id)}>{t('Открыть переменные execution')}</button>
      </article>)}{execution && <section><h3>{t('Переменные execution')}: {execution}</h3>{error ? <p role="alert" className="runtime-error">{text(error)}</p> : local ? <Variables variables={local} /> : <p>{t('Загрузка состояния…')}</p>}</section>}</>}
      {tab === 'jobs' && <>{!snapshot.deadLetters.length && <p className="runtime-empty">{t('Нет результатов')}</p>}{snapshot.deadLetters.map(job => <JobDetails key={job.id} connection={connection} job={job} focus={focus} />)}</>}
      {tab === 'tasks' && snapshot.tasks.map(task => <article key={task.id} className={`runtime-execution ${selected && task.taskDefinitionKey === selected ? 'selected' : ''}`}>
        <button className="runtime-link" onClick={() => focus(task.taskDefinitionKey)}>{task.name || task.taskDefinitionKey}</button><code>{task.id}</code><span>{t('Исполнитель')}: {task.assignee || '—'}</span>
      </article>)}
    </div>
  </aside>;
}
