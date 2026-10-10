import { useCallback, useEffect, useRef, useState } from 'react';
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
    // Предыдущая сессия и новая работа сохраняются одновременно до решения пользователя.
    try { writeRecovery(documents, recovery); } catch { report({ severity: 'error', message: 'Не удалось сохранить состояние для восстановления. Сохрани BPMN-файлы.' }); }
  }, [documents, recovery, report]);

  const add = useCallback((file: OpenedFile, restored?: import('./recovery').RecoveryRecord) => {
    const existing = file.path && current.current.find(document => document.path === file.path);
    setActivationRevision(value => value + 1);
    if (existing) { setActiveId(existing.id); return existing.id; }
    const id = crypto.randomUUID();
    const record: DocumentRecord = { id, name: file.name, path: file.path, token: file.token || undefined,
      sourceXml: file.xml, xml: file.xml, savedXml: restored?.savedXml ?? null, draft: restored?.draft };
    setDocuments(previous => [...previous, record]); setActiveId(id); return id;
  }, []);

  const create = useCallback((profile: DocumentProfile) => add({ token: '', path: '', name: t('Новая схема.bpmn'), xml: diagramTemplate(t, profile) }), [add, t]);
  useEffect(() => {
    const unsubscribe = bridge.onFiles(files => files.forEach(file => add(file)));
    bridge.initialFiles().then(files => files.forEach(file => add(file))).catch(error => report(errorNotice(error)));
    return unsubscribe;
  }, [add, report]);
  const open = useCallback(async () => { for (const file of await bridge.openFiles()) add(file); }, [add]);
  const openExample = useCallback(async (name: string) => { add(await bridge.openExample(name)); }, [add]);
  const openRecent = useCallback(async (path: string) => { add(await bridge.openRecent(path)); }, [add]);
  const drop = useCallback(async (files: File[]) => { for (const file of await bridge.openDropped(files)) add(file); }, [add]);

  const sync = useCallback((id: string, snapshot: EditorSnapshot) => {
    setDocuments(previous => previous.map(document => document.id === id ? {
      ...document, xml: snapshot.xml, snapshot, savedXml: document.savedXml ?? snapshot.xml,
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
      setDocuments(previous => previous.map(document => document.id === target.id ? { ...document, ...saved, token: saved.token || undefined, savedXml: xml } : document));
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
    for (const record of recovery) add({ token: '', path: '', name: record.name, xml: record.xml }, record);
    setRecovery([]);
  }, [add, recovery]);
  const discardRecovery = useCallback(() => { clearRecovery(); setRecovery([]); }, []);

  const prepareClose = useCallback(async () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    try {
      const records = await Promise.all(current.current.map(async record => ({
        ...record, xml: record.snapshot ? await editors.current.get(record.id)?.xml() ?? record.xml : record.xml,
      })));
      // Пишем свежую модель до ack main, не ожидая следующего React effect.
      writeRecovery(records, recovery);
      bridge.closeReady(records.some(isDirty));
    } catch (error) { report(errorNotice(error)); bridge.closeReady(true); }
  }, [recovery, report]);

  const run = useCallback((operation: () => void | Promise<void>, failure?: FailureContext) => {
    try { Promise.resolve(operation()).catch(error => report(errorNotice(error, failure))); } catch (error) { report(errorNotice(error, failure)); }
  }, [report]);

  return { documents, active, activeId, activationRevision, setActiveId, editors, add, create, open, openExample, openRecent, drop, sync, draft, importFailed, close, save, exportDiagram, recovery, restore, discardRecovery, prepareClose, run };
}
