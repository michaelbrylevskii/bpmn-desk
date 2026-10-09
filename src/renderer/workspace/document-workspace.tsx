import { Braces, Check, AlertTriangle, Minus, Plus, Maximize, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../shared/errors';
import { BpmnEditor, type EditorSnapshot } from '../bpmn/editor';
import type { DocumentRecord, EditorRegistry } from '../documents/types';
import { useI18n } from '../i18n/provider';
import { DefinitionsPanel } from '../properties/definitions-panel';
import { PropertiesPanel } from '../properties/properties-panel';
import { CodeEditor } from '../ui/code-editor';
import { DiagnosticsPanel } from './diagnostics-panel';
import { Outline } from './outline';
export function DocumentWorkspace({ record, active, editors, dark, sync, draft, importFailed, report, run }: {
  record: DocumentRecord; active: boolean; editors: EditorRegistry; dark: boolean;
  sync: (id: string, snapshot: EditorSnapshot) => void; draft: (id: string, value: string | undefined) => void;
  importFailed: (id: string) => void;
  report: (message: string) => void; run: (operation: () => void | Promise<void>) => void;
}) {
  const { t, text, language } = useI18n();
  const languageRef = useRef(language); languageRef.current = language;
  const container = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<BpmnEditor>();
  const [snapshot, setSnapshot] = useState<EditorSnapshot>();
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'xml' | 'diagnostics' | null>(null);
  const [definitions, setDefinitions] = useState(false);
  const source = useRef(record.sourceXml);
  const syncRef = useRef(sync); syncRef.current = sync;

  useEffect(() => {
    if (!container.current) return;
    const instance = new BpmnEditor(container.current, value => { setSnapshot(value); syncRef.current(record.id, value); }, () => languageRef.current);
    const resizeObserver = new ResizeObserver(() => instance.resize());
    resizeObserver.observe(container.current);
    editors.set(record.id, instance); setEditor(instance);
    instance.import(source.current).catch(problem => { setError(errorMessage(problem)); importFailed(record.id); });
    return () => { resizeObserver.disconnect(); editors.delete(record.id); instance.destroy(); };
  }, [record.id, editors, importFailed]);

  useEffect(() => {
    if (active && editor) { editor.resize(); }
  }, [active, editor, panel]);

  useEffect(() => { editor?.languageChanged(); }, [language, editor]);
  const ready = !!snapshot;
  useEffect(() => { if (ready && editor) { editor.resize(); editor.fit(); } }, [ready, editor]);

  const applyXml = async () => {
    if (!editor) return;
    await editor.import(record.draft ?? snapshot?.xml ?? source.current);
    draft(record.id, undefined); setError('');
    report(t("XML применён. История отмены сброшена."));
  };
  return <div className="document-workspace" style={{ display: active ? 'flex' : 'none' }}>
    {editor && snapshot && <Outline snapshot={snapshot} editor={editor} />}
    <div className="center-workspace">
      <div className="canvas-heading"><span><i />{error ? t("Ошибка импорта") : 'BPMN 2.0 · Flowable'}</span><span className="canvas-hint">{t("Пробел + перетаскивание · Ctrl + колесо")}</span>{snapshot && <button className="button small ghost" onClick={() => setDefinitions(true)}>{t("Определения")}</button>}</div>
      <div className="canvas-area"><div className="bpmn-container" ref={container} />
        {error && <div className="import-error"><AlertTriangle size={24} /><h3>{t("Не удалось открыть диаграмму")}</h3><pre>{text(error)}</pre><button className="button" onClick={() => setPanel('xml')}>{t("Открыть XML")}</button></div>}
        <div className="zoom-controls"><button title={t("Уменьшить")} onClick={() => editor?.zoom(0.8)}><Minus size={16} /></button><button title={t("Вписать схему")} onClick={() => editor?.fit()}><Maximize size={16} /></button><button title={t("Увеличить")} onClick={() => editor?.zoom(1.25)}><Plus size={16} /></button></div>
      </div>
      <div className="bottom-tabs">
        <button className={panel === 'xml' ? 'active' : ''} onClick={() => setPanel(panel === 'xml' ? null : 'xml')}><Braces size={15} />XML{record.draft !== undefined && record.draft !== record.xml && <i className="dirty-dot" />}</button>
        <button className={panel === 'diagnostics' ? 'active' : ''} onClick={() => setPanel(panel === 'diagnostics' ? null : 'diagnostics')}><AlertTriangle size={14} />{t("Диагностика")}<span className="badge">{snapshot?.diagnostics.length ?? 0}</span></button>
        <span className="bottom-spacer" />{panel && <button title={t("Закрыть панель")} onClick={() => setPanel(null)}><X size={14} /></button>}
      </div>
      {panel === 'xml' && <div className="bottom-panel xml-panel"><div className="xml-toolbar"><span>{t("Применение XML заменяет схему и сбрасывает историю отмены.")}</span>
        <button className="button small" onClick={() => run(applyXml)}><Check size={14} />{t("Применить XML")}</button><button className="button small ghost" onClick={() => draft(record.id, undefined)}>{t("Отменить правки XML")}</button></div>
        <CodeEditor value={record.draft ?? snapshot?.xml ?? source.current} onChange={value => draft(record.id, value)} dark={dark} selectedId={snapshot?.selected?.businessObject.id} /></div>}
      {panel === 'diagnostics' && <div className="bottom-panel"><DiagnosticsPanel diagnostics={snapshot?.diagnostics ?? []} onSelect={id => editor?.select(id)} onArrange={id => run(() => editor?.arrangeBoundaries(id))} /></div>}
    </div>
    {editor && snapshot && <PropertiesPanel editor={editor} snapshot={snapshot} dark={dark} run={run} />}
    {definitions && editor && snapshot && <DefinitionsPanel editor={editor} close={() => setDefinitions(false)} run={run} />}
  </div>;
}
