import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MonitorControls } from './controls';
import type { DiagramExport } from '../../shared/contracts';
import { bridge } from '../platform/bridge';
import { pngFromSvg } from '../bpmn/image-export';
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

export function RuntimeMonitor({ id, connection, revision, active, copy, publish }: { id: string; connection: string; revision: number; active: boolean; copy: (diagram: DeployedDiagram) => void; publish: (id: string, value: MonitorControls | undefined) => void }) {
  const { t, text } = useI18n();
  const [definitionId, setDefinitionId] = useState(''); const [instanceId, setInstanceId] = useState('');
  const [auto, setAuto] = useState(false); const [selected, setSelected] = useState(''); const [selectedJob, setSelectedJob] = useState<DeadLetterJob>();
  const viewer = useRef<RuntimeViewer | undefined>(undefined); const [ready, setReady] = useState(false);
  const snapshot = useSnapshot(connection, instanceId, auto, active);
  const refreshSnapshot = snapshot.refresh;
  useEffect(() => { if (revision) refreshSnapshot(); }, [revision, refreshSnapshot]);
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
      .catch(error => { if (!disposed) setLoaded(previous => ({ key: diagramKey, diagram: previous?.key === diagramKey ? previous.diagram : undefined, error: errorMessage(error) })); });
    return () => { disposed = true; };
  }, [connection, desiredDefinition, diagramKey, revision]);
  const openJob = (job: DeadLetterJob) => {
    if (job.processInstanceId) openInstance(job.processInstanceId);
    else { setInstanceId(''); setDefinitionId(job.processDefinitionId); }
    setSelectedJob({ ...job }); setSelected(job.elementId);
  };
  useEffect(() => { if (ready && selectedJob?.elementId) viewer.current?.focus(selectedJob.elementId); }, [ready, selectedJob]);
  const exportDiagram = useCallback(async (format: DiagramExport) => {
    if (!viewer.current || !diagram || !ready) return;
    const svg = await viewer.current.svg(); const name = `${diagram.definition.key}-runtime`;
    if (format === 'svg') await bridge.saveFile({ name: `${name}.svg`, format: 'svg', content: svg });
    else await bridge.saveFile({ name: `${name}.png`, format: 'png', content: await pngFromSvg(svg, format === 'png-white') });
  }, [diagram, ready]);
  const controls = useMemo<MonitorControls>(() => {
    const value: MonitorControls = { title: diagram?.definition.name || diagram?.definition.key || '', auto, busy: snapshot.busy, canRefresh: !!instanceId,
      canCopy: !!diagram, canExport: !!diagram && ready, refresh: snapshot.refresh,
      // Поле тулбара получает новое checked в том же событии, без ожидания passive effect.
      setAuto: auto => { setAuto(auto); publish(id, { ...value, auto }); },
      copy: () => { if (diagram) copy(diagram); }, fit: () => viewer.current?.fit(), exportDiagram };
    return value;
  }, [id, publish, diagram, auto, snapshot.busy, snapshot.refresh, instanceId, ready, copy, exportDiagram]);
  useEffect(() => { publish(id, controls); }, [id, publish, controls]);
  useEffect(() => () => publish(id, undefined), [id, publish]);
  return <div className="runtime-monitor">
    <div className="runtime-body"><RuntimeCatalog connection={connection} revision={revision} selectedInstance={instanceId} selectedDefinition={definitionId}
      definition={item => { setDefinitionId(item.id); setInstanceId(''); setSelected(''); setSelectedJob(undefined); }} instance={openInstance} job={openJob} />
      <div className="runtime-center">{snapshot.error && <p role="alert" className="runtime-error">{text(snapshot.error)} {snapshot.data && t('Последний снимок устарел.')}</p>}
        {snapshot.data?.warnings.map(warning => <p className="runtime-warning" key={warning}>{text(warning)}</p>)}
        {diagramError && <p role="alert" className="runtime-error">{text(diagramError)}</p>}
        {diagram ? <RuntimeDiagram diagram={diagram} snapshot={snapshot.data} select={select} viewer={viewer} onReady={setReady} /> : <p className="runtime-empty">{desiredDefinition || snapshot.busy ? t('Загрузка состояния…') : t('Выбери процесс или экземпляр.')}</p>}
        {snapshot.data && <div className="runtime-freshness"><time dateTime={snapshot.data.capturedAt}>{t('Время снимка')}: {new Date(snapshot.data.capturedAt).toLocaleTimeString()}</time><span>{t('Снимок собирается несколькими запросами и может измениться во время чтения.')}</span></div>}
      </div>
      {snapshot.data ? <InstanceDetails key={`${connection}:${instanceId}`} connection={connection} snapshot={snapshot.data} selected={selected} focus={focus} openInstance={openInstance} jobSelection={selectedJob} /> :
        selectedJob && <aside className="runtime-details"><JobDetails key={selectedJob.id} connection={connection} job={selectedJob} focus={focus} /></aside>}
    </div>
  </div>;
}
