import { useEffect, useRef, useState } from 'react';
import { Maximize, FileText, Activity, X, LoaderCircle } from 'lucide-react';
import type { DeployedDiagram, InstanceSnapshot } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { useI18n } from '../i18n/provider';
import { RuntimeViewer } from '../bpmn/runtime-viewer';
import type { useSummary } from './use-summary';
import { SummaryNotice } from './summary-notice';

export function RuntimeDiagram({ diagram, snapshot, summary, active, summaryEnabled, select, viewer, onReady }: { diagram: DeployedDiagram; snapshot?: InstanceSnapshot;
  summary: ReturnType<typeof useSummary>; active: boolean; summaryEnabled: boolean;
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
  useEffect(() => { if (ready) setMissing(viewer.current?.state(snapshot, summaryEnabled ? summary.data : undefined) ?? []); }, [snapshot, ready, viewer, summaryEnabled, summary.data]);
  return <section className="runtime-diagram"><div className="runtime-diagram-heading"><strong>{diagram.definition.name || diagram.definition.key}</strong><span>v{diagram.definition.version}</span>
    <span className="toolbar-spacer" />{summaryEnabled && <>
      <button className="button small runtime-summary-button" disabled={!ready || summary.busy || !active} title={t('Два запроса, до 100 записей каждого вида, не дольше 8 секунд.')} onClick={() => void summary.read()}>
        {summary.busy ? <LoaderCircle size={15} className="spinning" /> : <Activity size={15} />}{t(summary.data ? 'Обновить сводку' : 'Сводка версии')}</button>
      {(summary.data || summary.error) && <button className="icon-button" title={t('Скрыть сводку')} disabled={summary.busy} onClick={summary.clear}><X size={15} /></button>}
    </>}<button className="icon-button" title={t('XML схемы')} aria-pressed={xml} onClick={() => setXml(value => !value)}><FileText size={17} /></button>
    <button className="icon-button" title={t('Вписать схему')} onClick={() => viewer.current?.fit()}><Maximize size={17} /></button></div>
    {(snapshot || (summaryEnabled && summary.data)) && <div className="runtime-legend"><span className="active">{t(snapshot ? 'Активные элементы' : 'Экземпляры у элементов')}</span><span className="failed">{t(snapshot ? 'Задания с ошибкой' : 'Экземпляры с dead-letter')}</span></div>}
    {summaryEnabled && summary.data && <SummaryNotice summary={summary.data} />}
    {summaryEnabled && summary.error && <p className="runtime-error" role="alert">{text(summary.error)}</p>}
    {error && <p className="runtime-error" role="alert">{text(error)}</p>}
    {!diagram.definition.graphicalNotationDefined && <p className="runtime-warning">{t('Схема не содержит координат BPMN DI.')}</p>}
    {!!missing.length && <p className="runtime-warning">{t('На схеме отсутствуют элементы: {ids}', { ids: missing.join(', ') })}</p>}
    <div ref={container} className="runtime-canvas" tabIndex={0} aria-label={t('Развёрнутая схема')} />
    {(xml || error || !diagram.definition.graphicalNotationDefined) && <textarea className="runtime-xml" aria-label={t('XML схемы')} value={diagram.xml} readOnly spellCheck={false} />}
  </section>;
}
