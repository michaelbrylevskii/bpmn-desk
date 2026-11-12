import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionDocument, DiagramView } from '../../shared/sessions';
import type { DiagramExport, OpenedFile } from '../../shared/contracts';
import { errorNotice } from '../notifications/errors';
import type { ReportNotice, FailureContext } from '../notifications/types';
import type { DocumentProfile } from '../engines/contracts';
import type { EditorSnapshot } from '../bpmn/editor';
import { diagramTemplate } from '../bpmn/template';
import { saveDiagramExport } from './diagram-export';
import { useI18n } from '../i18n/provider';
import { bridge } from '../platform/bridge';
import { clearRecovery, readRecovery, writeRecovery } from './recovery';
import type { DocumentRecord, EditorRegistry } from './types';
import { hasPendingXml, isDirty } from './types';
export function useDocuments(report: ReportNotice) {
  const { t } = useI18n();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activeId, setActiveId] = useState('');
  const [activationRevision, setActivationRevision] = useState(0);
  const [recovery, setRecovery] = useState(readRecovery);
  const editors = useRef<EditorRegistry>(new Map());
  const current = useRef(documents); current.current = documents;
  const saving = useRef(false);
  const active = documents.find(document => document.id === activeId);
  const freshRecords = useCallback(async (ids?: string[]) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return Promise.all(current.current.filter(record => !ids || ids.includes(record.id)).map(async record => ({
      ...record, draft: hasPendingXml(record) ? record.draft : undefined,
      ...record.snapshot ? await editors.current.get(record.id)?.xmlState() : undefined,
    })));
  }, []);

  useEffect(() => {
    const dirty = documents.some(isDirty);
    bridge.setDirty(dirty);

  }, [documents, recovery, report]);

  const add = useCallback((file: OpenedFile, restored?: import('./recovery').RecoveryRecord) => {
    const existing = file.path && current.current.find(document => document.path === file.path);
    setActivationRevision(value => value + 1);
    if (existing) { setActiveId(existing.id); return existing.id; }
    const id = crypto.randomUUID();
    const record: DocumentRecord = { id, name: file.name, path: file.path, token: file.token || undefined,
      sourceXml: file.xml, diskXml: file.xml, xml: file.xml, savedXml: restored?.savedXml ?? null, draft: restored?.draft === file.xml ? undefined : restored?.draft, baselineDraft: restored?.baselineDraft };
    setDocuments(previous => [...previous, record]); setActiveId(id); return id;
  }, []);

  const restoreDocument = useCallback((record: SessionDocument): string => {
    const existing = record.path && current.current.find(document => document.path === record.path);
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    const next: DocumentRecord = { ...record, id, sourceXml: record.xml, draft: record.draft === record.xml ? undefined : record.draft };
    current.current = [...current.current, next];
    setDocuments(previous => [...previous, next]);
    return id;
  }, []);
  const view = useCallback((id: string, view: DiagramView) => setDocuments(previous => previous.map(record => record.id === id ? { ...record, view } : record)), []);
  const tokenKey = documents.map(record => record.token).filter(Boolean).join('\n');
  useEffect(() => {
    if (!tokenKey) return;
    let disposed = false; let busy = false;
    const check = async () => {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const statuses = await bridge.fileStatuses(tokenKey.split('\n'));
        if (!disposed) setDocuments(previous => {
          let changed = false;
          const next = previous.map(record => {
            const status = statuses.find(status => status.token === record.token);
            if (!status || (record.fileState ?? 'unchanged') === status.state && record.fileError === status.error) return record;
            changed = true; return { ...record, fileState: status.state, fileError: status.error };
          });
          return changed ? next : previous;
        });
      } catch (error) { if (!disposed) report(errorNotice(error)); }
      finally { busy = false; }
    };
    void check(); const interval = setInterval(() => { void check(); }, 3000);
    window.addEventListener('focus', check); document.addEventListener('visibilitychange', check);
    return () => { disposed = true; clearInterval(interval); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  }, [tokenKey, report]);

  const reload = useCallback(async (id: string) => {
    const [target] = await freshRecords([id]); if (!target?.token) return;
    if (isDirty(target) && !window.confirm(t('Перезагрузить «{name}» и отбросить несохранённые изменения?', { name: target.name }))) return;
    const editor = editors.current.get(id); if (!editor) return;
    const file = await bridge.reloadFile(target.token);
    const position = target.view ?? editor.view();
    await editor.import(file.xml);
    editor.restoreView(position);
    const xml = await editor.xml();
    setDocuments(previous => previous.map(record => record.id === id ? { ...record, ...file, sourceXml: file.xml, diskXml: file.xml, xml, savedXml: xml, draft: undefined, baselineDraft: undefined, fileState: 'unchanged', fileError: undefined } : record));
  }, [freshRecords, t]);
  const duplicate = useCallback(async (id: string) => {
    const [target] = await freshRecords([id]); if (!target) return '';
    const state = { xml: target.xml, guardXml: target.guardXml ?? target.sourceXml };
    const draft = hasPendingXml(target) ? target.draft : undefined;
    // Первая сериализация новой модели задаёт базу без различий форматирования при импорте.
    return restoreDocument({ id: '', name: t('Копия {name}', { name: target.name }), path: '', ...state, diskXml: state.xml, savedXml: null, draft, baselineDraft: draft, view: target.view });
  }, [freshRecords, restoreDocument, t]);
  const closeMany = useCallback(async (ids: string[]) => {
    const dirty = (await freshRecords(ids)).filter(isDirty);
    const question = dirty.length === 1 ? t('Закрыть «{name}» и отбросить несохранённые изменения?', { name: dirty[0]!.name }) : t('Закрыть вкладки и отбросить изменения в документах: {names}?', { names: dirty.map(record => record.name).join(', ') });
    if (dirty.length && !window.confirm(question)) return false;
    setDocuments(previous => {
      const next = previous.filter(record => !ids.includes(record.id));
      if (ids.includes(activeId)) setActiveId(next.at(-1)?.id ?? '');
      return next;
    }); return true;
  }, [activeId, freshRecords, t]);
  const create = useCallback((profile: DocumentProfile) => add({ token: '', path: '', name: t('Новая схема.bpmn'), xml: diagramTemplate(t, profile) }), [add, t]);
  useEffect(() => {
    const unsubscribe = bridge.onFiles(files => files.forEach(file => add(file)));
    bridge.initialFiles().then(files => files.forEach(file => add(file))).catch(error => report(errorNotice(error)));
    return unsubscribe;
  }, [add, report]);
  const open = useCallback(async () => { return (await bridge.openFiles()).map(file => add(file)); }, [add]);
  const openExample = useCallback(async (name: string) => { return add(await bridge.openExample(name)); }, [add]);
  const openRecent = useCallback(async (path: string) => { return add(await bridge.openRecent(path)); }, [add]);
  const drop = useCallback(async (files: File[]) => { return (await bridge.openDropped(files)).map(file => add(file)); }, [add]);

  const sync = useCallback((id: string, snapshot: EditorSnapshot) => {
    setDocuments(previous => previous.map(document => document.id === id ? {
      ...document, draft: hasPendingXml(document) ? document.draft : undefined,
      xml: snapshot.xml, guardXml: snapshot.baselineXml, snapshot, view: document.view ? { ...document.view, selected: snapshot.selected?.id } : undefined, savedXml: document.savedXml ?? snapshot.xml,
    } : document));
  }, []);

  const draft = useCallback((id: string, value: string | undefined) => {
    setDocuments(previous => previous.map(document => document.id === id ? { ...document, draft: value === document.xml ? undefined : value } : document));
  }, []);

  const importFailed = useCallback((id: string) => {
    setDocuments(previous => previous.map(document => document.id === id && document.savedXml === null ? { ...document, savedXml: document.sourceXml } : document));
  }, []);

  const save = useCallback(async (saveAs = false, documentId?: string) => {
    if (saving.current) return;
    const [target] = await freshRecords([documentId ?? activeId]);
    if (!target || saving.current) return;
    const editor = editors.current.get(target.id);
    if (!editor) return;
    if (hasPendingXml(target)) throw new Error('Примени или отмени изменения XML перед сохранением.');
    saving.current = true;
    try {
      const xml = await editor.checkedXml();
      const saved = await bridge.saveFile({ token: target.token, name: target.name, content: xml, saveAs });
      if (!saved) return;
      setDocuments(previous => previous.map(document => document.id === target.id ? { ...document, ...saved, token: saved.token || undefined, savedXml: xml, diskXml: xml, baselineDraft: undefined, fileState: 'unchanged', fileError: undefined } : document));
      report({ severity: 'success', message: `Сохранено: ${saved.name}` });
    } finally { saving.current = false; }
  }, [activeId, freshRecords, report]);

  const exportDiagram = useCallback(async (format: DiagramExport, documentId?: string) => {
    const target = documentId ? current.current.find(item => item.id === documentId) : active;
    if (!target) return;
    const editor = editors.current.get(target.id);
    if (!editor) return;
    const svg = await editor.svg();
    const name = target.name.replace(/\.(bpmn20\.xml|bpmn|xml)$/i, '');
    return saveDiagramExport(svg, name, format);
  }, [active]);

  const restore = useCallback(() => {
    const ids = recovery.map(record => add({ token: '', path: '', name: record.name, xml: record.xml }, record));
    setRecovery([]); return ids;
  }, [add, recovery]);
  const discardRecovery = useCallback(() => { clearRecovery(); setRecovery([]); }, []);

  const prepareClose = useCallback(async (persist?: (records: DocumentRecord[]) => Promise<void>) => {
    try {
      const records = await freshRecords();
      // Пишем свежую модель до ack main, не ожидая следующего React effect.
      if (persist) await persist(records); else writeRecovery(records, recovery);
      bridge.closeReady(records.some(isDirty));
    } catch (error) { report(errorNotice(error)); bridge.closeReady(true, false); }
  }, [freshRecords, recovery, report]);

  const run = useCallback((operation: () => void | Promise<void>, failure?: FailureContext) => {
    try { Promise.resolve(operation()).catch(error => report(errorNotice(error, failure))); } catch (error) { report(errorNotice(error, failure)); }
  }, [report]);

  return { restoreDocument, view, reload, duplicate, closeMany, documents, active, activeId, activationRevision, setActiveId, editors, add, create, open, openExample, openRecent, drop, sync, draft, importFailed, save, exportDiagram, recovery, restore, discardRecovery, prepareClose, run };
}
