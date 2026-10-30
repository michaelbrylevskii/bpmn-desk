import { useEffect, useRef, useState } from 'react';
import { Maximize, FileText } from 'lucide-react';
import type { DeployedDiagram, InstanceSnapshot } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { useI18n } from '../i18n/provider';
import { CodeEditor } from '../ui/code-editor';
import { RuntimeViewer } from '../bpmn/runtime-viewer';
import type { useSummary } from './use-summary';
import { RuntimeLegend } from './legend';
import { SummaryStatus } from './summary-status';
import type { HistorySnapshot } from '../../shared/history';

export function RuntimeDiagram({ instances, definition, dark, selected, diagram, snapshot, history, summary, definitionView, summaryEnabled, setSummaryEnabled, requestTimeout, select, viewer, onReady }: { instances: () => void; definition?: () => void; dark: boolean; selected: string; diagram: DeployedDiagram; snapshot?: InstanceSnapshot; history?: HistorySnapshot;
  summary: ReturnType<typeof useSummary>; definitionView: boolean; summaryEnabled: boolean; setSummaryEnabled: (value: boolean) => void; requestTimeout: number;
  select: (id: string) => void; viewer: React.RefObject<RuntimeViewer | undefined>; onReady: (value: boolean) => void }) {
  const { t, language, text } = useI18n(); const container = useRef<HTMLDivElement>(null); const currentLanguage = useRef(language); currentLanguage.current = language;
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [missing, setMissing] = useState<string[]>([]); const [xml, setXml] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    let disposed = false; setReady(false); onReady(false); setError(''); setMissing([]);
    const instance = new RuntimeViewer(container.current, () => currentLanguage.current, select); viewer.current = instance;
    const observer = new ResizeObserver(() => instance.resize()); observer.observe(container.current);
    void instance.import(diagram.xml).then(() => { if (!disposed) { setReady(true); onReady(true); } }).catch(error => { if (!disposed) setError(errorMessage(error)); });
    return () => { disposed = true; onReady(false); observer.disconnect(); instance.destroy(); if (viewer.current === instance) viewer.current = undefined; };
  }, [diagram.xml, select, viewer, onReady]);
  useEffect(() => { if (ready) setMissing(viewer.current?.state(snapshot, definitionView && summaryEnabled ? summary.data : undefined, history) ?? []); }, [snapshot, history, ready, viewer, definitionView, summaryEnabled, summary.data]);
  return <section className="runtime-diagram"><div className="runtime-diagram-heading"><strong>{diagram.definition.name || diagram.definition.key}</strong><span>v{diagram.definition.version}</span>
    <button className="runtime-link diagram-context-link" onClick={definition ?? instances}>{t(definition ? 'Определение' : 'Экземпляры')}</button>
    <span className="toolbar-spacer" />{definitionView && <SummaryStatus summary={summary} enabled={summaryEnabled} toggle={() => setSummaryEnabled(!summaryEnabled)} timeout={requestTimeout} />}
    <button className="icon-button" title={t('XML схемы')} aria-pressed={xml} onClick={() => setXml(value => !value)}><FileText size={17} /></button>
    <button className="icon-button" title={t('Вписать схему')} onClick={() => viewer.current?.fit()}><Maximize size={17} /></button></div>
    <RuntimeLegend runtime={!!snapshot} history={!!history} summary={definitionView && summaryEnabled && !!summary.data} />
    {error && <p className="runtime-error" role="alert">{text(error)}</p>}
    {!diagram.definition.graphicalNotationDefined && <p className="runtime-warning">{t('Схема не содержит координат BPMN DI.')}</p>}
    {!!missing.length && <p className="runtime-warning">{t('На схеме отсутствуют элементы: {ids}', { ids: missing.join(', ') })}</p>}
    <div ref={container} className="runtime-canvas" tabIndex={0} aria-label={t('Развёрнутая схема')} />
    {(xml || error || !diagram.definition.graphicalNotationDefined) && <div className="runtime-xml"><CodeEditor value={diagram.xml} dark={dark} selectedId={selected} readOnly /></div>}
  </section>;
}
