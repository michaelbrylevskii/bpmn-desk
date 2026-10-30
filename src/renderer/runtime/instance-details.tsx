import type { Instance } from '../../shared/runtime';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { DeadLetterJob, InstanceSnapshot, Variable } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';
import { Variables } from './variables';
import { JobDetails } from './job-details';
import { InstanceRelationships } from './relationships';

export function InstanceDetails({ connection, snapshot, selected, focus, openInstance, jobSelection }: {
  connection: string; snapshot: InstanceSnapshot; selected: string; focus: (id: string) => void; openInstance: (id: string, preview?: Instance) => void;
  jobSelection?: DeadLetterJob;
}) {
  const { t, text } = useI18n(); const [tab, setTab] = useState<'variables' | 'executions' | 'jobs' | 'tasks'>(jobSelection ? 'jobs' : 'variables');
  const jobsTab = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (jobSelection) setTab('jobs'); }, [jobSelection]);
  const [execution, setExecution] = useState(''); const [local, setLocal] = useState<Variable[]>(); const [error, setError] = useState('');
  useEffect(() => {
    if (!execution || tab !== 'executions') return;
    if (!snapshot.executions.some(item => item.id === execution)) { setExecution(''); return; }
    let disposed = false; setLocal(undefined); setError('');
    void runtimeBridge().executionVariables(connection, execution).then(value => { if (!disposed) setLocal(value); }).catch(error => { if (!disposed) setError(errorMessage(error)); });
    return () => { disposed = true; };
  }, [connection, execution, tab, snapshot.capturedAt, snapshot.executions]);
  const process = snapshot.instance;
  return <aside className="runtime-details">
    <div className="runtime-instance"><strong>{process.businessKey || process.name || process.id}</strong><code>{process.id}</code>
      <dl><dt>{t('Движок')}</dt><dd>Flowable</dd><dt>{t('Состояние')}</dt><dd>{process.suspended ? t('Приостановлен') : t('Активен')}</dd>
        <dt>{t('ID определения')}</dt><dd>{process.processDefinitionId}</dd><dt>{t('Tenant ID')}</dt><dd>{process.tenantId || '—'}</dd>
        <dt>{t('Начат')}</dt><dd>{process.startTime ? new Date(process.startTime).toLocaleString() : '—'}</dd></dl>
      {!!snapshot.deadLetters.length && <button className="runtime-error runtime-job-alert" onClick={() => { setTab('jobs'); jobsTab.current?.focus(); jobsTab.current?.scrollIntoView({ block: 'nearest' }); }}><span>{t('Есть dead-letter jobs')}: {snapshot.deadLetters.length}</span><ArrowRight size={16} aria-hidden="true" /></button>}
      <InstanceRelationships connection={connection} parent={process.superProcessInstanceId} children={snapshot.children} incomplete={snapshot.unavailable.includes('children')} open={openInstance} />
      {selected && <p className="runtime-selection">{t('Выбранный элемент')}: <code>{selected}</code></p>}
    </div>
    <nav className="runtime-tabs">{([{ id: 'variables', label: 'Переменные процесса' }, { id: 'executions', label: 'Executions' }, { id: 'jobs', label: 'Dead-letter jobs' }, { id: 'tasks', label: 'Задачи' }] as const).map(item =>
      <button key={item.id} ref={item.id === 'jobs' ? jobsTab : undefined} aria-pressed={tab === item.id} onClick={() => setTab(item.id)}>{t(item.label)}{item.id === 'jobs' && ` (${snapshot.unavailable.includes('deadLetters') ? '—' : snapshot.deadLetters.length})`}</button>)}</nav>
    <div className="runtime-detail-body">
      {tab === 'variables' && <Variables variables={snapshot.variables} unavailable={snapshot.unavailable.includes('variables')} />}
      {tab === 'executions' && <>{!snapshot.executions.length && <p className="runtime-empty">{t(snapshot.unavailable.includes('executions') ? 'Состояние недоступно' : 'Нет результатов')}</p>}{snapshot.executions.map(item => <article className={`runtime-execution ${selected && item.activityId === selected ? 'selected' : ''}`} key={item.id}>
        <>{item.activityId ? <button className="runtime-link" onClick={() => focus(item.activityId)}>{item.activityId}</button> : <span>Scope</span>}</><code>{item.id}</code><small>{t('Родительский execution')}: {item.parentId || '—'}</small>
        <button className="button small" aria-pressed={execution === item.id} onClick={() => setExecution(item.id)}>{t('Открыть переменные execution')}</button>
      </article>)}{execution && <section><h3>{t('Переменные execution')}: {execution}</h3>{error ? <p role="alert" className="runtime-error">{text(error)}</p> : local ? <Variables variables={local} /> : <p>{t('Загрузка состояния…')}</p>}</section>}</>}
      {tab === 'jobs' && <>{!snapshot.deadLetters.length && <p className="runtime-empty">{t(snapshot.unavailable.includes('deadLetters') ? 'Состояние недоступно' : 'Нет результатов')}</p>}{snapshot.deadLetters.map(job => <JobDetails key={job.id} connection={connection} job={job} activityId={job.elementId || snapshot.executions.find(item => item.id === job.executionId)?.activityId} focus={focus} />)}</>}
      {tab === 'tasks' && <>{!snapshot.tasks.length && <p className="runtime-empty">{t(snapshot.unavailable.includes('tasks') ? 'Состояние недоступно' : 'Нет результатов')}</p>}{snapshot.tasks.map(task => <article key={task.id} className={`runtime-execution ${selected && task.taskDefinitionKey === selected ? 'selected' : ''}`}>
        <>{task.taskDefinitionKey ? <button className="runtime-link" onClick={() => focus(task.taskDefinitionKey)}>{task.name || task.taskDefinitionKey}</button> : <span>{task.name || task.id}</span>}</><code>{task.id}</code><span>{t('Исполнитель')}: {task.assignee || '—'}</span>
      </article>)}</>}
    </div>
  </aside>;
}
