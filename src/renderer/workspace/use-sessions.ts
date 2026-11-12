import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionDocument, SessionOverview, SessionTab, WorkspaceSession } from '../../shared/sessions';
import type { DocumentRecord } from '../documents/types';
import type { RecoveryRecord } from '../documents/recovery';
import { bridge } from '../platform/bridge';
import type { ReportNotice } from '../notifications/types';
import { errorNotice } from '../notifications/errors';
import type { MonitorControls } from '../runtime/controls';
import { useI18n } from '../i18n/provider';

export function useSessions({ documents, tabs, activeId, controls, restoreDocument, merge, recovery, clearRecovery, report }: {
  documents: DocumentRecord[]; tabs: SessionTab[]; activeId: string; controls: Record<string, MonitorControls>;
  restoreDocument: (document: SessionDocument) => string; merge: (tabs: SessionTab[], activeId: string, sourceHome?: string) => void;
  recovery: RecoveryRecord[]; clearRecovery: () => void; report: ReportNotice;
}) {
  const { t } = useI18n();
  const [startup, setStartup] = useState<string | null>(null);
  const [items, setItems] = useState<SessionOverview[]>([]); const [offeredId, setOfferedId] = useState(''); const [ready, setReady] = useState(false); const [restoring, setRestoring] = useState(false);
  const identity = useRef<string>(crypto.randomUUID()); const queue = useRef<Promise<void>>(Promise.resolve());
  const persisted = useRef(''); const haveSnapshot = useRef(false);
  const snapshot = useMemo(() => ({ tabs: tabs.map(tab => tab.kind === 'monitor' ? { ...tab, monitor: controls[tab.id]?.session ?? tab.monitor } : tab), activeId,
    documents: documents.map(record => ({ id: record.id, name: record.name, path: record.path, token: record.token,
      xml: record.xml, guardXml: record.guardXml, diskXml: record.diskXml ?? record.sourceXml, savedXml: record.savedXml, draft: record.draft, baselineDraft: record.baselineDraft, view: record.view })) }), [tabs, activeId, documents, controls]);
  const latest = useRef(snapshot); latest.current = snapshot;
  const refresh = useCallback(async () => setItems(await bridge.sessions()), []);
  useEffect(() => {
    let disposed = false;
    void (async () => {
      if (recovery.length) {
        const id = 'legacy-recovery'; const existing = await bridge.sessions();
        if (!existing.some(item => item.id === id)) {
          const documents = recovery.map((record, index) => ({ ...record, id: `legacy-${index}`, path: '', diskXml: record.savedXml }));
          await bridge.saveSession({ id, updatedAt: new Date().toISOString(), dismissed: false, documents, tabs: documents.map(record => ({ kind: 'document', id: record.id })), activeId: documents.at(-1)?.id ?? '' });
        }
        clearRecovery();
      }
      const items = await bridge.sessions(); const initial = await bridge.initialSession();
      if (!disposed) { setStartup(initial); }
      if (!disposed) { setItems(items); setOfferedId([...items].filter(item => !item.open).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0]?.id ?? ''); setReady(true); }
    })().catch(error => report(errorNotice(error)));
    return () => { disposed = true; };
  }, [clearRecovery, recovery, report]);

  const flush = useCallback((fresh?: DocumentRecord[]): Promise<void> => {
    const value = latest.current;
    const documents = fresh ? value.documents.map(record => { const updated = fresh.find(item => item.id === record.id); return updated ? { ...record, xml: updated.xml, guardXml: updated.guardXml, draft: updated.draft, view: updated.view } : record; }) : value.documents;
    const content = { ...value, documents }; const serialized = JSON.stringify(content);
    if (serialized === persisted.current || !content.tabs.some(tab => tab.kind !== 'home') && !haveSnapshot.current) return queue.current;
    const session: WorkspaceSession = { ...content, id: identity.current, dismissed: false, updatedAt: new Date().toISOString() };
    // Учитываем и ожидающую запись: закрытие всех вкладок должно удалить её после завершения.
    if (session.tabs.some(tab => tab.kind !== 'home')) haveSnapshot.current = true;
    queue.current = queue.current.catch(() => undefined).then(async () => {
      await bridge.saveSession(session); persisted.current = serialized;
      haveSnapshot.current = session.tabs.some(tab => tab.kind !== 'home') || latest.current.tabs.some(tab => tab.kind !== 'home');
      await refresh();
    });
    return queue.current;
  }, [refresh]);
  useEffect(() => {
    if (!ready || restoring) return;
    const timer = setTimeout(() => { void flush().catch(() => report({ severity: 'error', message: 'Не удалось сохранить сессию. Сохрани BPMN-файлы.' })); }, 600);
    return () => clearTimeout(timer);
  }, [snapshot, ready, restoring, flush, report]);
  useEffect(() => {
    const save = () => { void flush().catch(error => report(errorNotice(error))); };
    window.addEventListener('beforeunload', save); return () => window.removeEventListener('beforeunload', save);
  }, [flush, report]);

  const restore = useCallback(async (id: string, sourceHome?: string) => {
    if (restoring) return;
    setRestoring(true);
    try {
      await queue.current;
      const occupied = latest.current.tabs.some(tab => tab.kind !== 'home');
      const session = await bridge.restoreSession(id, occupied); if (!session) return; const mapping = new Map<string, string>();
      if (latest.current.tabs.some(tab => tab.kind !== 'home')) { await bridge.restoreSession(id, true); return; }
      for (const document of session.documents) mapping.set(document.id, restoreDocument(document));
      const tabs = session.tabs.map(tab => {
        const newId = tab.kind === 'document' ? mapping.get(tab.id)! : crypto.randomUUID(); mapping.set(tab.id, newId);
        return { ...tab, id: newId };
      });
      identity.current = session.id; haveSnapshot.current = true;
      persisted.current = ''; merge(tabs, mapping.get(session.activeId) ?? tabs[0]?.id ?? '', sourceHome);
      setItems(previous => previous.filter(item => item.id !== session.id));
    } finally { setRestoring(false); }
  }, [restoring, restoreDocument, merge]);
  useEffect(() => {
    if (!ready || !startup || restoring) return;
    const id = startup; setStartup(null);
    void restore(id).catch(error => report(errorNotice(error)));
  }, [startup, ready, restoring, restore, report]);
  useEffect(() => bridge.onWorkspaceChanged(kind => { if (kind === 'sessions') void refresh().catch(error => report(errorNotice(error))); }), [refresh, report]);
  const dismiss = useCallback(async (id: string) => { await bridge.dismissSession(id); await refresh(); }, [refresh]);
  const setPin = useCallback(async (id: string, name: string | null) => { await bridge.setSessionPin(id, name); await refresh(); }, [refresh]);
  const remove = useCallback(async (id: string) => {
    const session = items.find(item => item.id === id);
    if (session?.tabs.some(tab => tab.dirty) && !window.confirm(t('Удалить сессию и её несохранённые изменения?'))) return;
    await bridge.deleteSession(id); await refresh();
  }, [items, refresh, t]);
  const recent = items.filter(item => item.id !== identity.current);
  return { items: recent, offered: recent.find(item => item.id === offeredId && !item.dismissed && !item.open), restore, dismiss, remove, setPin, flush, restoring };
}
