import { undo, redo } from '@codemirror/commands';
import { EditorView } from '@codemirror/view';
import { Workflow, CircleCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DiagramExport } from '../shared/contracts';
import type { DeployedDiagram } from '../shared/runtime';
import { errorNotice } from './notifications/errors';
import type { Notice } from './notifications/types';
import { NotificationToast } from './ui/notification-toast';
import { engineProfiles } from './engines/profiles';
import { isDirty } from './documents/types';
import { useDocuments } from './documents/use-documents';
import { useI18n } from './i18n/provider';
import { bridge } from './platform/bridge';
import { Toolbar } from './ui/toolbar';
import { useTheme } from './ui/use-theme';
import { NewDiagramDialog } from './ui/new-diagram-dialog';
import { Welcome } from './ui/welcome';
import { DocumentWorkspace } from './workspace/document-workspace';
import { Tabs } from './workspace/tabs';
import { useTabs } from './workspace/use-tabs';
import { RuntimeWorkspace } from './runtime/workspace';
import { RuntimeToolbar } from './runtime/toolbar';
import { ConnectionsDialog } from './runtime/connections-dialog';
import { useConnections } from './runtime/use-connections';
import { useMonitorControls } from './runtime/controls';
export function App() {
  const { t, text, setLanguage } = useI18n(); const [notice, setNotice] = useState<Notice & { id: string }>();
  const report = useCallback((value: Notice) => setNotice({ ...value, id: crypto.randomUUID() }), []);
  const [creating, setCreating] = useState(false); const requestNew = useCallback(() => setCreating(true), []);
  const [managing, setManaging] = useState<string>(); const docs = useDocuments(report);
  const documentIds = useMemo(() => docs.documents.map(item => item.id), [docs.documents]);
  const tabs = useTabs(documentIds, docs.activeId, docs.activationRevision); const activeTab = tabs.tabs.find(tab => tab.id === tabs.activeId);
  const active = activeTab?.kind === 'document' ? docs.documents.find(item => item.id === activeTab.id) : undefined;
  const monitoring = activeTab?.kind === 'monitor'; const monitors = tabs.tabs.filter(tab => tab.kind === 'monitor');
  const profiles = useConnections(creating || managing !== undefined || !!monitors.length); const handles = useMonitorControls(); const controls = handles.controls[tabs.activeId];
  const { mode: theme, dark, setMode: setTheme } = useTheme(); const [examples, setExamples] = useState<string[]>([]); const [recent, setRecent] = useState<string[]>([]); const [dragging, setDragging] = useState(false);
  const addDocument = docs.add;
  const copy = useCallback((diagram: DeployedDiagram) => { addDocument({ name: `${diagram.definition.key}.bpmn20.xml`, path: '', token: '', xml: diagram.xml }); }, [addDocument]);
  useEffect(() => { void bridge.examples().then(setExamples).catch(error => report(errorNotice(error))); void bridge.recentFiles().then(setRecent).catch(error => report(errorNotice(error))); }, [report, docs.documents.length]);
  const exportDiagram = useCallback((format: DiagramExport) => docs.run(() => monitoring ? controls?.exportDiagram(format) : docs.exportDiagram(format, active?.id)), [docs, monitoring, controls, active?.id]);
  const onAction = useCallback((action: string) => {
    if ((action === 'undo' || action === 'redo') && document.activeElement instanceof HTMLElement) {
      const view = EditorView.findFromDOM(document.activeElement);
      if (view) { (action === 'undo' ? undo : redo)(view); return; }
      if (document.activeElement.matches('input, textarea')) { document.execCommand(action); return; }
    }
    if (monitoring && ['save', 'save-as', 'undo', 'redo'].includes(action)) return;
    const editor = active ? docs.editors.current.get(active.id) : undefined;
    switch (action) {
      case 'new': requestNew(); break;
      case 'open': docs.run(docs.open); break;
      case 'save': docs.run(() => docs.save(false, active?.id)); break;
      case 'save-as': docs.run(() => docs.save(true, active?.id)); break;
      case 'export': exportDiagram('svg'); break;
      case 'undo': editor?.undo(); break;
      case 'redo': editor?.redo(); break;
      case 'fit': if (monitoring) controls?.fit(); else editor?.fit(); break;
      case 'prepare-close': docs.run(docs.prepareClose); break;
    }
  }, [docs, active, monitoring, controls, exportDiagram, requestNew]);
  useEffect(() => bridge.onAction(onAction), [onAction]);
  useEffect(() => {
    if (window.desktop) return;
    const listener = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !(event.ctrlKey || event.metaKey)) return;
      const editingText = event.target instanceof HTMLElement && event.target.closest('input,textarea,[contenteditable="true"]'); const key = event.key.toLowerCase();
      const action = key === 's' ? event.shiftKey ? 'save-as' : 'save' : key === 'o' ? 'open' : key === 'n' ? 'new' : !editingText && key === 'z' ? event.shiftKey ? 'redo' : 'undo' : key === '0' && event.shiftKey ? 'fit' : undefined;
      if (action) { event.preventDefault(); onAction(action); }
    };
    document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener);
  }, [onAction]);
  return <div className="app" onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); docs.run(() => docs.drop(Array.from(event.dataTransfer.files))); }}>
    <Toolbar hasDocument={!!active?.snapshot} canUndo={!!active?.snapshot?.canUndo} canRedo={!!active?.snapshot?.canRedo} theme={theme} onTheme={setTheme} onAction={onAction}
      onLanguage={value => docs.run(() => setLanguage(value))} onExport={exportDiagram} canExport={monitoring ? !!controls?.canExport : !!active?.snapshot}
      runtimeTools={monitoring ? <RuntimeToolbar connectionId={activeTab.connectionId} connections={profiles.data.items} controls={controls} choose={id => { tabs.changeConnection(activeTab.id, id); profiles.remember(id); }} manage={setManaging} /> : undefined} />
    <Tabs tabs={tabs.tabs} activeId={tabs.activeId} documents={docs.documents} connections={profiles.data.items} controls={handles.controls} activate={tabs.activate}
      close={tab => tab.kind === 'document' ? docs.close(tab.id) : tabs.closeMonitor(tab.id)} create={requestNew} />
    {docs.documents.length > 0 && docs.recovery.length > 0 && <div className="pending-recovery"><span>{t('Остались несохранённые документы предыдущей сессии: {count}', { count: docs.recovery.length })}</span><button className="button small" onClick={docs.restore}>{t('Восстановить')}</button><button className="button small ghost" onClick={docs.discardRecovery}>{t('Отбросить')}</button></div>}
    <div className="workspaces">{docs.documents.map(record => <DocumentWorkspace key={record.id} record={record} active={record.id === tabs.activeId}
      editors={docs.editors.current} dark={dark} sync={docs.sync} draft={docs.draft} importFailed={docs.importFailed} report={report} run={docs.run} />)}
      {monitors.map(tab => <div className="workspace-surface" key={tab.id} hidden={tab.id !== tabs.activeId}><RuntimeWorkspace id={tab.id} connectionId={tab.connectionId} connections={profiles.data} revision={profiles.revisions[tab.connectionId] ?? 0} active={tab.id === tabs.activeId} copy={copy} publish={handles.publish} /></div>)}
      {!tabs.tabs.length && <Welcome create={requestNew} open={() => docs.run(docs.open)} examples={examples} recent={recent} openExample={name => docs.run(() => docs.openExample(name))} openRecent={path => docs.run(() => docs.openRecent(path))} recovery={docs.recovery.length} restore={docs.restore} discardRecovery={docs.discardRecovery} />}</div>
    <footer className="statusbar"><span><CircleCheck size={13} />{monitoring ? t('Состояние процессов') : active ? t('{count} элементов', { count: active.snapshot?.items.length ?? 0 }) : t('Готово')}</span>
      <span>{active?.snapshot && <span className="engine-badge">{active.snapshot.engines.map(id => engineProfiles[id].title).join(' + ') || 'BPMN 2.0'}</span>}{monitoring ? 'Flowable REST API' : active?.snapshot?.selected?.id ?? 'BPMN 2.0 · Flowable · Camunda 7'}</span><span className="status-spacer" />
      <span>{monitoring ? t('Только чтение') : active && isDirty(active) ? t('Есть несохранённые изменения') : active && !active.path ? t('Без файла · сохрани копию') : t('Все изменения сохранены')}</span></footer>
    {notice && <NotificationToast key={notice.id} notice={notice} close={() => setNotice(undefined)} />}
    {dragging && <div className="drop-overlay"><Workflow size={44} /><h2>{t('Отпусти BPMN-файлы здесь')}</h2><p>{t('Схемы откроются в отдельных вкладках')}</p></div>}
    {creating && <NewDiagramDialog close={() => setCreating(false)} create={profile => { docs.create(profile); setCreating(false); }} connections={profiles.data.items} savedId={profiles.preferredId}
      monitor={id => { tabs.createMonitor(id); profiles.remember(id); setCreating(false); }} manage={() => setManaging('')} />}
    {managing !== undefined && <ConnectionsDialog connections={profiles.data} initialId={managing} close={() => setManaging(undefined)} changed={profiles.refresh} />}
    {creating && profiles.error && <NotificationToast notice={{ severity: 'error', message: text(profiles.error) }} close={() => setCreating(false)} />}
  </div>;
}
