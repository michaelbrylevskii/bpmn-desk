import { undo, redo } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { X, Workflow, CircleCheck, Info } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../shared/errors';
import type { DocumentProfile } from './engines/contracts';
import { engineProfiles } from './engines/profiles';
import { isDirty } from './documents/types';
import { useDocuments } from './documents/use-documents';
import { useI18n } from './i18n/provider';
import { bridge } from './platform/bridge';
import { Toolbar } from './ui/toolbar';
import { NewDiagramDialog } from './ui/new-diagram-dialog';
import { Welcome } from './ui/welcome';
import { DocumentWorkspace } from './workspace/document-workspace';
export function App() {
  const { t, text, setLanguage } = useI18n();
  const [message, setMessage] = useState('');
  const report = useCallback((value: string) => setMessage(value), []);
  const [creating, setCreating] = useState(false);
  const requestNew = useCallback(() => setCreating(true), []);
  const docs = useDocuments(report);
  const [dark, setDark] = useState(() => localStorage.getItem('bpmn-desk:theme') !== 'light');
  const [examples, setExamples] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('bpmn-desk:theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { void bridge.examples().then(setExamples).catch(error => report(errorMessage(error))); void bridge.recentFiles().then(setRecent).catch(error => report(errorMessage(error))); }, [report, docs.documents.length]);

  const onAction = useCallback((action: string) => {
    const editor = docs.editors.current.get(docs.activeId);
    if ((action === 'undo' || action === 'redo') && document.activeElement instanceof HTMLElement) {
      const view = EditorView.findFromDOM(document.activeElement);
      if (view) { (action === 'undo' ? undo : redo)(view); return; }
      if (document.activeElement.matches('input, textarea')) { document.execCommand(action); return; }
    }
    switch (action) {
      case 'new': requestNew(); break;
      case 'open': docs.run(docs.open); break;
      case 'save': docs.run(() => docs.save()); break;
      case 'save-as': docs.run(() => docs.save(true)); break;
      case 'export': docs.run(() => docs.exportDiagram('svg')); break;
      case 'undo': editor?.undo(); break;
      case 'redo': editor?.redo(); break;
      case 'fit': editor?.fit(); break;
      case 'theme': setDark(value => !value); break;
      case 'prepare-close': docs.run(docs.prepareClose); break;
    }
  }, [docs, requestNew]);

  useEffect(() => bridge.onAction(onAction), [onAction]);
  useEffect(() => {
    if (window.desktop) return;
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey)) return;
      const editingText = event.target instanceof HTMLElement && (event.target.closest('input,textarea,[contenteditable="true"]'));
      const key = event.key.toLowerCase();
      const action = key === 's' ? event.shiftKey ? 'save-as' : 'save' : key === 'o' ? 'open' : key === 'n' ? 'new' : !editingText && key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === '0' && event.shiftKey ? 'fit' : undefined;
      if (action) { event.preventDefault(); onAction(action); }
    };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [onAction]);

  return <div className="app" onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); docs.run(() => docs.drop(Array.from(event.dataTransfer.files))); }}>
    <Toolbar hasDocument={!!docs.active?.snapshot} canUndo={!!docs.active?.snapshot?.canUndo} canRedo={!!docs.active?.snapshot?.canRedo} dark={dark} onAction={onAction} onLanguage={value => docs.run(() => setLanguage(value))} onExport={format => docs.run(() => docs.exportDiagram(format))} />
    {docs.documents.length > 0 && <nav className="document-tabs" aria-label={t("Открытые схемы")}>{docs.documents.map(record => <div key={record.id} className={`document-tab ${docs.activeId === record.id ? 'active' : ''}`}>
      <button title={record.path || record.name} onClick={() => docs.setActiveId(record.id)}><Workflow size={14} /><span>{record.name}</span>{isDirty(record) && <i className="dirty-dot" aria-label={t("Несохранённые изменения")} />}</button>
      <button title={t('Закрыть {name}', { name: record.name })} onClick={() => docs.close(record.id)}><X size={13} /></button>
    </div>)}<button className="new-tab" title={t("Новая схема")} onClick={requestNew}>+</button></nav>}
    {docs.documents.length > 0 && docs.recovery.length > 0 && <div className="pending-recovery"><span>{t('Остались несохранённые документы предыдущей сессии: {count}', { count: docs.recovery.length })}</span><button className="button small" onClick={docs.restore}>{t("Восстановить")}</button><button className="button small ghost" onClick={docs.discardRecovery}>{t("Отбросить")}</button></div>}
    <div className="workspaces">{docs.documents.length ? docs.documents.map(record => <DocumentWorkspace key={record.id} record={record} active={record.id === docs.activeId}
      editors={docs.editors.current} dark={dark} sync={docs.sync} draft={docs.draft} importFailed={docs.importFailed} report={report} run={docs.run} />) :
      <Welcome create={requestNew} open={() => docs.run(docs.open)} examples={examples} recent={recent} openExample={name => docs.run(() => docs.openExample(name))}
        openRecent={path => docs.run(() => docs.openRecent(path))} recovery={docs.recovery.length} restore={docs.restore} discardRecovery={docs.discardRecovery} />}</div>
    <footer className="statusbar"><span><CircleCheck size={13} />{docs.active ? t('{count} элементов', { count: docs.active.snapshot?.items.length ?? 0 }) : t("Готово")}</span><span>{docs.active?.snapshot && <span className="engine-badge">{docs.active.snapshot.engines.map(id => engineProfiles[id].title).join(" + ") || "BPMN 2.0"}</span>}{docs.active?.snapshot?.selected?.id ?? 'BPMN 2.0 · Flowable · Camunda 7'}</span><span className="status-spacer" /><span>{docs.active && isDirty(docs.active) ? t("Есть несохранённые изменения") : docs.active && !docs.active.path ? t("Без файла · сохрани копию") : t("Все изменения сохранены")}</span></footer>
    {message && <div className="toast" role="status"><Info size={18} /><span>{text(message)}</span><button title={t("Закрыть уведомление")} onClick={() => setMessage('')}><X size={16} /></button></div>}
    {dragging && <div className="drop-overlay"><Workflow size={44} /><h2>{t("Отпусти BPMN-файлы здесь")}</h2><p>{t("Схемы откроются в отдельных вкладках")}</p></div>}
    {creating && <NewDiagramDialog close={() => setCreating(false)} create={(profile: DocumentProfile) => { docs.create(profile); setCreating(false); }} />}
  </div>;
}
