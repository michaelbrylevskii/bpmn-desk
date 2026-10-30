import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
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
import { JobDetails } from './job-details';
import { useSnapshot } from './use-snapshot';
import { useSummary } from './use-summary';
import { SummaryDetails } from './summary-details';
import { useHistory } from './use-history';
import { InstancePanel } from './instance-panel';
import { RuntimeFreshness } from './freshness';
import { MonitorPanel } from './monitor-panel';

export function RuntimeMonitor({ id, connection, revision, active, copy, publish }: { id: string; connection: string; revision: number; active: boolean; copy: (diagram: DeployedDiagram) => void; publish: (id: string, value: MonitorControls | undefined) => void }) {
  const { t, text } = useI18n();
  const [definitionId, setDefinitionId] = useState(''); const [instanceId, setInstanceId] = useState('');
  const [auto, setAuto] = useState(false); const [selected, setSelected] = useState(''); const [selectedJob, setSelectedJob] = useState<DeadLetterJob>();
  const [historyMode, setHistoryMode] = useState(false); const [catalogHidden, setCatalogHidden] = useState(false); const [detailsHidden, setDetailsHidden] = useState(false);
  const [back, setBack] = useState<{ id: string; history: boolean }[]>([]);
  const viewer = useRef<RuntimeViewer | undefined>(undefined); const [ready, setReady] = useState(false);
  const snapshot = useSnapshot(connection, instanceId, auto, active);
  const history = useHistory(connection, instanceId, auto, active, revision);
  const historyData = history.data; const currentData = snapshot.data;
  const busy = snapshot.busy || history.busy;
  const refreshSnapshot = snapshot.refresh; const refreshHistory = history.refresh;
  const refreshState = useCallback(() => { refreshSnapshot(); refreshHistory(); }, [refreshSnapshot, refreshHistory]);
  useEffect(() => { if (revision) refreshSnapshot(); }, [revision, refreshSnapshot]);
  const instanceDefinition = currentData?.instance.processDefinitionId ?? historyData?.instance.processDefinitionId;
  const desiredDefinition = instanceDefinition ?? definitionId;
  const summary = useSummary(connection, desiredDefinition, revision, !instanceId && active && !!desiredDefinition);
  const [loaded, setLoaded] = useState<{ key: string; diagram?: DeployedDiagram; error?: string }>();
  const diagramKey = `${connection}\n${desiredDefinition}`; const diagram = loaded?.key === diagramKey ? loaded.diagram : undefined;
  const diagramError = loaded?.key === diagramKey ? loaded.error : undefined;
  const select = useCallback((id: string) => setSelected(id), []);
  const focus = useCallback((id: string) => { setSelected(id); if (id) viewer.current?.focus(id); else viewer.current?.clearSelection(); }, []);
  const openInstance = useCallback((id: string, history = false) => { setInstanceId(id); setHistoryMode(history); setDefinitionId(''); setSelected(''); setSelectedJob(undefined); setBack([]); }, []);
  const followInstance = (id: string) => { setBack(previous => [...previous, { id: instanceId, history: historyMode }]); setInstanceId(id); setDefinitionId(''); setSelected(''); setSelectedJob(undefined); };
  useEffect(() => {
    if (!connection || !desiredDefinition) return;
    let disposed = false;
    void runtimeBridge().diagram(connection, desiredDefinition).then(diagram => { if (!disposed) setLoaded({ key: diagramKey, diagram }); })
      .catch(error => { if (!disposed) setLoaded(previous => ({ key: diagramKey, diagram: previous?.key === diagramKey ? previous.diagram : undefined, error: errorMessage(error) })); });
    return () => { disposed = true; };
  }, [connection, desiredDefinition, diagramKey, revision]);
  const openJob = (job: DeadLetterJob) => {
    if (job.processInstanceId) openInstance(job.processInstanceId);
    else { setInstanceId(''); setDefinitionId(job.processDefinitionId); setHistoryMode(false); setBack([]); }
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
    const value: MonitorControls = { title: diagram?.definition.name || diagram?.definition.key || '', auto, busy, canRefresh: !!instanceId,
      canCopy: !!diagram, canExport: !!diagram && ready, refresh: refreshState,
      // Поле тулбара получает новое checked в том же событии, без ожидания passive effect.
      setAuto: auto => { setAuto(auto); publish(id, { ...value, auto }); },
      copy: () => { if (diagram) copy(diagram); }, fit: () => viewer.current?.fit(), exportDiagram };
    return value;
  }, [id, publish, diagram, auto, busy, refreshState, instanceId, ready, copy, exportDiagram]);
  useEffect(() => { publish(id, controls); }, [id, publish, controls]);
  useEffect(() => () => publish(id, undefined), [id, publish]);
  return <div className="runtime-monitor">
    <div className="runtime-body"><MonitorPanel side="left" hidden={catalogHidden} toggle={() => setCatalogHidden(value => !value)}><RuntimeCatalog connection={connection} revision={revision} selectedInstance={instanceId} selectedDefinition={definitionId}
      definition={item => { setDefinitionId(item.id); setInstanceId(''); setSelected(''); setSelectedJob(undefined); setHistoryMode(false); setBack([]); }} instance={openInstance} job={openJob} /></MonitorPanel>
      <div className="runtime-center">{!!back.length && <div className="runtime-context-bar">
        <button className="button small ghost" onClick={() => { const target = back.at(-1); if (target) { setInstanceId(target.id); setHistoryMode(target.history); setSelected(''); setBack(previous => previous.slice(0, -1)); } }}><ArrowLeft size={14} />{t('Назад к экземпляру')}</button>
      </div>}
        {snapshot.error && <p role="alert" className="runtime-error">{t('Текущее состояние')}: {text(snapshot.error)} {currentData && t('Последний снимок устарел.')}</p>}
        {history.error && <p role="alert" className="runtime-error">{t('История выполнения')}: {text(history.error)} {historyData && t('Последний снимок устарел.')}<span className="history-error-hint">{t('Проверь доступ к history API. Запись могла быть очищена или история отключена.')}</span></p>}

        {currentData?.warnings.map(warning => <p className="runtime-warning" key={warning}>{text(warning)}</p>)}
        {diagramError && <p role="alert" className="runtime-error">{text(diagramError)}</p>}
        {diagram ? <RuntimeDiagram diagram={diagram} snapshot={currentData} history={historyData} summary={summary} active={active} summaryEnabled={!instanceId} select={select} viewer={viewer} onReady={setReady} /> : !snapshot.error && !history.error && !diagramError && <p className="runtime-empty">{desiredDefinition || busy ? t('Загрузка состояния…') : t('Выбери процесс или экземпляр.')}</p>}
        <RuntimeFreshness runtime={currentData?.capturedAt} history={historyData?.capturedAt} />

      </div>
      {(!!instanceId || !!selectedJob || !!selected && !!summary.data) && <MonitorPanel side="right" hidden={detailsHidden} toggle={() => setDetailsHidden(value => !value)} changed={`${instanceId}:${selected}`}>
        {instanceId ? <InstancePanel key={`${connection}:${instanceId}`} connection={connection} snapshot={snapshot} history={history} historyMode={historyMode} setHistoryMode={setHistoryMode}
        xml={diagram?.xml} selected={selected} focus={focus} openInstance={followInstance} jobSelection={selectedJob} /> :
        selectedJob ? <aside className="runtime-details"><JobDetails key={selectedJob.id} connection={connection} job={selectedJob} focus={focus} /></aside> :
          !instanceId && selected && summary.data && <SummaryDetails key={`${diagramKey}:${selected}`} summary={summary.data} element={selected} open={(id, job) => job ? openJob(job) : openInstance(id)} />}
      </MonitorPanel>}
    </div>
  </div>;
}
