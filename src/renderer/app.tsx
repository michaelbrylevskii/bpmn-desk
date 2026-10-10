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
  const { t, setLanguage } = useI18n(); const [notice, setNotice] = useState<Notice & { id: string }>();
  const report = useCallback((value: Notice) => setNotice({ ...value, id: crypto.randomUUID() }), []);
  const [managing, setManaging] = useState<string>(); const docs = useDocuments(report);
  const documentIds = useMemo(() => docs.documents.map(item => item.id), [docs.documents]);
  const tabs = useTabs(documentIds, docs.activeId, docs.activationRevision); const activeTab = tabs.tabs.find(tab => tab.id === tabs.activeId);
  const active = activeTab?.kind === 'document' ? docs.documents.find(item => item.id === activeTab.id) : undefined;
  const monitoring = activeTab?.kind === 'monitor'; const monitors = tabs.tabs.filter(tab => tab.kind === 'monitor');
  const home = !tabs.tabs.length || activeTab?.kind === 'home'; const sourceHome = activeTab?.kind === 'home' ? activeTab.id : undefined;
  const createHome = tabs.createHome;
  const requestNew = useCallback(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); createHome(); }, [createHome]);
  const profiles = useConnections(home || managing !== undefined || !!monitors.length); const handles = useMonitorControls(); const controls = handles.controls[tabs.activeId];
  const { mode: theme, dark, setMode: setTheme } = useTheme(); const [examples, setExamples] = useState<string[]>([]); const [recent, setRecent] = useState<string[]>([]); const [dragging, setDragging] = useState(false);
  const addDocument = docs.add;
  const copy = useCallback((diagram: DeployedDiagram) => { addDocument({ name: `${diagram.definition.key}.bpmn20.xml`, path: '', token: '', xml: diagram.xml }); }, [addDocument]);
  useEffect(() => { void bridge.examples().then(setExamples).catch(error => report(errorNotice(error))); }, [report]);
  useEffect(() => {
    if (!home) return;
    let disposed = false;
    void bridge.recentFiles().then(items => { if (!disposed) setRecent(items); }).catch(error => { if (!disposed) report(errorNotice(error)); });
    return () => { disposed = true; };
  }, [report, docs.documents.length, tabs.activeId, home]);
  const { documentOpened, activate: activateTab } = tabs; const runDocument = docs.run;
  const finishOpening = useCallback((ids: string | string[]) => { const opened = typeof ids === 'string' ? [ids] : ids; if (opened.length) { documentOpened(opened[0]!, sourceHome); activateTab(opened.at(-1)!); } }, [documentOpened, activateTab, sourceHome]);
  const openContent = useCallback((operation: () => Promise<string | string[]>) => runDocument(async () => { finishOpening(await operation()); }), [runDocument, finishOpening]);
  const exportDiagram = useCallback((format: DiagramExport) => docs.run(() => monitoring ? controls?.exportDiagram(format) : docs.exportDiagram(format, active?.id)), [docs, monitoring, controls, active?.id]);
  const onAction = useCallback((action: string) => {
    if ((action === 'undo' || action === 'redo') && document.activeElement instanceof HTMLElement) {
      const view = EditorView.findFromDOM(document.activeElement);
      if (view) { (action === 'undo' ? undo : redo)(view); return; }
      if (document.activeElement.matches('input, textarea')) { document.execCommand(action); return; }
    }
    if (home && ['save', 'save-as', 'undo', 'redo', 'export', 'fit'].includes(action)) return;
    if (monitoring && ['save', 'save-as', 'undo', 'redo'].includes(action)) return;
    const editor = active ? docs.editors.current.get(active.id) : undefined;
    switch (action) {
      case 'new': requestNew(); break;
      case 'open': openContent(docs.open); break;
      case 'save': docs.run(() => docs.save(false, active?.id)); break;
      case 'save-as': docs.run(() => docs.save(true, active?.id)); break;
      case 'export': exportDiagram('svg'); break;
      case 'undo': editor?.undo(); break;
      case 'redo': editor?.redo(); break;
      case 'fit': if (monitoring) controls?.fit(); else editor?.fit(); break;
      case 'prepare-close': docs.run(docs.prepareClose); break;
    }
  }, [docs, active, monitoring, home, controls, exportDiagram, requestNew, openContent]);
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
    onDrop={event => { event.preventDefault(); setDragging(false); const files = Array.from(event.dataTransfer.files); openContent(() => docs.drop(files)); }}>
    <Toolbar hasDocument={!!active?.snapshot} canUndo={!!active?.snapshot?.canUndo} canRedo={!!active?.snapshot?.canRedo} theme={theme} onTheme={setTheme} onAction={onAction}
      onLanguage={value => docs.run(() => setLanguage(value))} onExport={exportDiagram} canExport={monitoring ? !!controls?.canExport : !!active?.snapshot}
      onManageConnections={() => setManaging(monitoring ? activeTab.connectionId : profiles.data.items.find(item => item.id === profiles.preferredId)?.id ?? profiles.data.items[0]?.id ?? '')}
      runtimeTools={monitoring ? <RuntimeToolbar connectionId={activeTab.connectionId} connections={profiles.data.items} controls={controls} choose={id => { tabs.changeConnection(activeTab.id, id); profiles.remember(id); }} manage={setManaging} /> : undefined} />
    <Tabs tabs={tabs.tabs} activeId={tabs.activeId} documents={docs.documents} connections={profiles.data.items} controls={handles.controls} activate={tabs.activate}
      close={tab => tab.kind === 'document' ? docs.close(tab.id) : tabs.closeTab(tab.id)} create={requestNew} />
    {docs.documents.length > 0 && docs.recovery.length > 0 && <div className="pending-recovery"><span>{t('Остались несохранённые документы предыдущей сессии: {count}', { count: docs.recovery.length })}</span><button className="button small" onClick={docs.restore}>{t('Восстановить')}</button><button className="button small ghost" onClick={docs.discardRecovery}>{t('Отбросить')}</button></div>}
    <div className="workspaces">{docs.documents.map(record => <DocumentWorkspace key={record.id} record={record} active={record.id === tabs.activeId}
      editors={docs.editors.current} dark={dark} sync={docs.sync} draft={docs.draft} importFailed={docs.importFailed} report={report} run={docs.run} />)}
      {monitors.map(tab => <div className="workspace-surface" key={tab.id} hidden={tab.id !== tabs.activeId}><RuntimeWorkspace id={tab.id} connectionId={tab.connectionId} connections={profiles.data} revision={profiles.revisions[tab.connectionId] ?? 0} active={tab.id === tabs.activeId} copy={copy} publish={handles.publish} /></div>)}
      {home && <Welcome key={sourceHome ?? 'initial'} create={profile => docs.run(() => { tabs.documentOpened(docs.create(profile), sourceHome); })} open={() => openContent(docs.open)}
        examples={examples} recent={recent} openExample={name => openContent(() => docs.openExample(name))} openRecent={path => openContent(() => docs.openRecent(path))}
        connections={profiles.data.items} savedId={profiles.preferredId} connectionError={profiles.error} manage={() => setManaging('')}
        monitor={id => { tabs.createMonitor(id, sourceHome); profiles.remember(id); }}
        recovery={docs.documents.length ? 0 : docs.recovery.length} restore={() => finishOpening(docs.restore())} discardRecovery={docs.discardRecovery} />}</div>
    <footer className="statusbar"><span><CircleCheck size={13} />{monitoring ? t('Состояние процессов') : active ? t('{count} элементов', { count: active.snapshot?.items.length ?? 0 }) : t('Готово')}</span>
      <span>{active?.snapshot && <span className="engine-badge">{active.snapshot.engines.map(id => engineProfiles[id].title).join(' + ') || 'BPMN 2.0'}</span>}{monitoring ? 'Flowable REST API' : active?.snapshot?.selected?.id ?? 'BPMN 2.0 · Flowable · Camunda 7'}</span><span className="status-spacer" />
      <span>{home ? t('Стартовая страница') : monitoring ? t('Только чтение') : active && isDirty(active) ? t('Есть несохранённые изменения') : active && !active.path ? t('Без файла · сохрани копию') : t('Все изменения сохранены')}</span></footer>
    {notice && <NotificationToast key={notice.id} notice={notice} close={() => setNotice(undefined)} />}
    {dragging && <div className="drop-overlay"><Workflow size={44} /><h2>{t('Отпусти BPMN-файлы здесь')}</h2><p>{t('Схемы откроются в отдельных вкладках')}</p></div>}
    {managing !== undefined && <ConnectionsDialog connections={profiles.data} initialId={managing} close={() => setManaging(undefined)} changed={profiles.refresh} />}
  </div>;
}
