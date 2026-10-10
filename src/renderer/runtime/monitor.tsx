import { useCallback, useEffect, useRef, useState } from 'react';
import { CopyPlus, RefreshCw, Search } from 'lucide-react';
import type { DeadLetterJob, DeployedDiagram } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';
import type { RuntimeViewer } from '../bpmn/runtime-viewer';
import { RuntimeCatalog } from './catalog';
import { RuntimeDiagram } from './diagram';
import { InstanceDetails } from './instance-details';
import { JobDetails } from './job-details';
import { useSnapshot } from './use-snapshot';

export function RuntimeMonitor({ connection, controls, active, copy }: { connection: string; controls: React.ReactNode; active: boolean; copy: (diagram: DeployedDiagram) => void }) {
  const { t, text } = useI18n();
  const [definitionId, setDefinitionId] = useState(''); const [instanceId, setInstanceId] = useState(''); const [idInput, setIdInput] = useState('');
  const [auto, setAuto] = useState(false); const [selected, setSelected] = useState(''); const [selectedJob, setSelectedJob] = useState<DeadLetterJob>();
  const viewer = useRef<RuntimeViewer | undefined>(undefined);
  const snapshot = useSnapshot(connection, instanceId, auto, active);
  const desiredDefinition = snapshot.data?.instance.processDefinitionId ?? definitionId;
  const [loaded, setLoaded] = useState<{ key: string; diagram?: DeployedDiagram; error?: string }>();
  const diagramKey = `${connection}\n${desiredDefinition}`; const diagram = loaded?.key === diagramKey ? loaded.diagram : undefined;
  const diagramError = loaded?.key === diagramKey ? loaded.error : undefined;
  const select = useCallback((id: string) => setSelected(id), []);
  const focus = useCallback((id: string) => { if (id) { setSelected(id); viewer.current?.focus(id); } }, []);
  const openInstance = useCallback((id: string) => { setInstanceId(id); setDefinitionId(''); setSelected(''); setSelectedJob(undefined); }, []);
  useEffect(() => {
    if (!connection || !desiredDefinition) return;
    let disposed = false;
    void runtimeBridge().diagram(connection, desiredDefinition).then(diagram => { if (!disposed) setLoaded({ key: diagramKey, diagram }); })
      .catch(error => { if (!disposed) setLoaded({ key: diagramKey, error: errorMessage(error) }); });
    return () => { disposed = true; };
  }, [connection, desiredDefinition, diagramKey]);
  const openJob = (job: DeadLetterJob) => {
    if (job.processInstanceId) openInstance(job.processInstanceId);
    else { setInstanceId(''); setDefinitionId(job.processDefinitionId); }
    setSelectedJob({ ...job }); setSelected(job.elementId);
  };
  return <div className="runtime-monitor">
    <header className="runtime-header">{controls}
      <form className="runtime-open-instance" onSubmit={event => { event.preventDefault(); if (idInput.trim()) openInstance(idInput.trim()); }}>
        <input aria-label={t('ID экземпляра')} placeholder={t('ID экземпляра')} value={idInput} onChange={event => setIdInput(event.target.value)} /><button className="icon-button" title={t('Открыть экземпляр')} disabled={!connection || !idInput.trim()}><Search size={17} /></button></form>
      <span className="toolbar-spacer" /><label className="runtime-check"><input type="checkbox" checked={auto} disabled={!instanceId} onChange={event => setAuto(event.target.checked)} />{t('Автообновление каждые 5 секунд')}</label>
      <button className="icon-button" title={t('Обновить состояние')} disabled={!instanceId || snapshot.busy} onClick={snapshot.refresh}><RefreshCw className={snapshot.busy ? 'spinning' : ''} size={17} /></button>
      <button className="button" disabled={!diagram} onClick={() => { if (diagram) copy(diagram); }}><CopyPlus size={16} />{t('Создать локальную копию')}</button></header>
    <div className="runtime-body"><RuntimeCatalog connection={connection}
      definition={item => { setDefinitionId(item.id); setInstanceId(''); setSelected(''); setSelectedJob(undefined); }} instance={openInstance} job={openJob} />
      <div className="runtime-center">{snapshot.error && <p role="alert" className="runtime-error">{text(snapshot.error)} {snapshot.data && t('Последний снимок устарел.')}</p>}
        {snapshot.data?.warnings.map(warning => <p className="runtime-warning" key={warning}>{text(warning)}</p>)}
        {diagramError && <p role="alert" className="runtime-error">{text(diagramError)}</p>}
        {diagram ? <RuntimeDiagram diagram={diagram} snapshot={snapshot.data} select={select} viewer={viewer} /> : <p className="runtime-empty">{desiredDefinition || snapshot.busy ? t('Загрузка состояния…') : t('Выбери процесс или экземпляр.')}</p>}
        {snapshot.data && <div className="runtime-freshness"><time dateTime={snapshot.data.capturedAt}>{t('Время снимка')}: {new Date(snapshot.data.capturedAt).toLocaleTimeString()}</time><span>{t('Снимок собирается несколькими запросами и может измениться во время чтения.')}</span></div>}
      </div>
      {snapshot.data ? <InstanceDetails key={`${connection}:${instanceId}`} connection={connection} snapshot={snapshot.data} selected={selected} focus={focus} openInstance={openInstance} jobSelection={selectedJob} /> :
        selectedJob && <aside className="runtime-details"><JobDetails key={selectedJob.id} connection={connection} job={selectedJob} focus={focus} /></aside>}
    </div>
  </div>;
}
