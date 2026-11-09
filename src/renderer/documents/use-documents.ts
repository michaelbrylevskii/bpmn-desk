import { useCallback, useEffect, useRef, useState } from 'react';
import type { SessionDocument, DiagramView } from '../../shared/sessions';
import type { DiagramExport, OpenedFile } from '../../shared/contracts';
import { errorNotice } from '../notifications/errors';
import type { ReportNotice, FailureContext } from '../notifications/types';
import type { DocumentProfile } from '../engines/contracts';
import type { EditorSnapshot } from '../bpmn/editor';
import { diagramTemplate } from '../bpmn/template';
import { pngFromSvg } from '../bpmn/image-export';
import { useI18n } from '../i18n/provider';
import { bridge } from '../platform/bridge';
import { clearRecovery, readRecovery, writeRecovery } from './recovery';
import type { DocumentRecord, EditorRegistry } from './types';
import { isDirty } from './types';
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
      sourceXml: file.xml, diskXml: file.xml, xml: file.xml, savedXml: restored?.savedXml ?? null, draft: restored?.draft };
    setDocuments(previous => [...previous, record]); setActiveId(id); return id;
  }, []);

  const restoreDocument = useCallback((record: SessionDocument): string => {
    const existing = record.path && current.current.find(document => document.path === record.path);
    if (existing) return existing.id;
    const id = crypto.randomUUID();
    const next: DocumentRecord = { ...record, id, sourceXml: record.xml };
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
    const target = current.current.find(record => record.id === id); if (!target?.token) return;
    if (isDirty(target) && !window.confirm(t('Перезагрузить «{name}» и отбросить несохранённые изменения?', { name: target.name }))) return;
    const editor = editors.current.get(id); if (!editor) return;
    const file = await bridge.reloadFile(target.token);
    const position = target.view ?? editor.view();
    await editor.import(file.xml);
    editor.restoreView(position);
    const xml = await editor.xml();
    setDocuments(previous => previous.map(record => record.id === id ? { ...record, ...file, sourceXml: file.xml, diskXml: file.xml, xml, savedXml: xml, draft: undefined, fileState: 'unchanged', fileError: undefined } : record));
  }, [t]);
  const duplicate = useCallback(async (id: string) => {
    const target = current.current.find(record => record.id === id); if (!target) return '';
    const state = await editors.current.get(id)?.xmlState() ?? { xml: target.xml, guardXml: target.guardXml ?? target.sourceXml };
    return restoreDocument({ id: '', name: t('Копия {name}', { name: target.name }), path: '', ...state, diskXml: state.xml, savedXml: '', draft: target.draft, view: target.view });
  }, [restoreDocument, t]);
  const closeMany = useCallback((ids: string[]) => {
    const dirty = current.current.filter(record => ids.includes(record.id) && isDirty(record));
    if (dirty.length && !window.confirm(t('Закрыть вкладки и отбросить изменения в документах: {names}?', { names: dirty.map(record => record.name).join(', ') }))) return false;
    setDocuments(previous => previous.filter(record => !ids.includes(record.id))); return true;
  }, [t]);
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
      ...document, xml: snapshot.xml, guardXml: snapshot.baselineXml, snapshot, view: document.view ? { ...document.view, selected: snapshot.selected?.id } : undefined, savedXml: document.savedXml ?? snapshot.xml,
    } : document));
  }, []);

  const draft = useCallback((id: string, value: string | undefined) => {
    setDocuments(previous => previous.map(document => document.id === id ? { ...document, draft: value } : document));
  }, []);

  const importFailed = useCallback((id: string) => {
    setDocuments(previous => previous.map(document => document.id === id && document.savedXml === null ? { ...document, savedXml: document.sourceXml } : document));
  }, []);

  const close = useCallback((id: string) => {
    const record = current.current.find(document => document.id === id);
    if (record && isDirty(record) && !window.confirm(t('Закрыть «{name}» и отбросить несохранённые изменения?', { name: record.name }))) return;
    setDocuments(previous => {
      const next = previous.filter(document => document.id !== id);
      if (id === activeId) setActiveId(next.at(-1)?.id ?? '');
      return next;
    });
  }, [activeId, t]);

  const save = useCallback(async (saveAs = false, documentId?: string) => {
    const target = documentId ? current.current.find(item => item.id === documentId) : active;
    if (!target || saving.current) return;
    const editor = editors.current.get(target.id);
    if (!editor) return;
    if (target.draft !== undefined && target.draft !== target.xml) throw new Error('Примени или отмени изменения XML перед сохранением.');
    saving.current = true;
    try {
      const xml = await editor.checkedXml();
      const saved = await bridge.saveFile({ token: target.token, name: target.name, content: xml, saveAs });
      if (!saved) return;
      setDocuments(previous => previous.map(document => document.id === target.id ? { ...document, ...saved, token: saved.token || undefined, savedXml: xml, diskXml: xml, fileState: 'unchanged', fileError: undefined } : document));
      report({ severity: 'success', message: `Сохранено: ${saved.name}` });
    } finally { saving.current = false; }
  }, [active, report]);

  const exportDiagram = useCallback(async (format: DiagramExport, documentId?: string) => {
    const target = documentId ? current.current.find(item => item.id === documentId) : active;
    if (!target) return;
    const editor = editors.current.get(target.id);
    if (!editor) return;
    const svg = await editor.svg();
    const name = target.name.replace(/\.(bpmn20\.xml|bpmn|xml)$/i, '');
    if (format === 'svg') await bridge.saveFile({ name: `${name}.svg`, content: svg, format: 'svg' });
    else await bridge.saveFile({ name: `${name}.png`, content: await pngFromSvg(svg, format === 'png-white'), format: 'png' });
  }, [active]);

  const restore = useCallback(() => {
    const ids = recovery.map(record => add({ token: '', path: '', name: record.name, xml: record.xml }, record));
    setRecovery([]); return ids;
  }, [add, recovery]);
  const discardRecovery = useCallback(() => { clearRecovery(); setRecovery([]); }, []);

  const prepareClose = useCallback(async (persist?: (records: DocumentRecord[]) => Promise<void>) => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    try {
      const records = await Promise.all(current.current.map(async record => ({
        ...record, ...record.snapshot ? await editors.current.get(record.id)?.xmlState() : undefined,
      })));
      // Пишем свежую модель до ack main, не ожидая следующего React effect.
      if (persist) await persist(records); else writeRecovery(records, recovery);
      bridge.closeReady(records.some(isDirty));
    } catch (error) { report(errorNotice(error)); bridge.closeReady(true, false); }
  }, [recovery, report]);

  const run = useCallback((operation: () => void | Promise<void>, failure?: FailureContext) => {
    try { Promise.resolve(operation()).catch(error => report(errorNotice(error, failure))); } catch (error) { report(errorNotice(error, failure)); }
  }, [report]);

  return { restoreDocument, view, reload, duplicate, closeMany, documents, active, activeId, activationRevision, setActiveId, editors, add, create, open, openExample, openRecent, drop, sync, draft, importFailed, close, save, exportDiagram, recovery, restore, discardRecovery, prepareClose, run };
}
