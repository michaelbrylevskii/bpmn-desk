import type { FileState } from '../../shared/contracts';
import type { DiagramView } from '../../shared/sessions';
import { documentChanged } from '../../shared/sessions';
import type { EditorSnapshot, BpmnEditor } from '../bpmn/editor';

export interface DocumentRecord {
  id: string;
  name: string;
  path: string;
  token?: string;
  sourceXml: string;
  xml: string;
  savedXml: string | null;
  draft?: string;
  baselineDraft?: string;
  snapshot?: EditorSnapshot;
  guardXml?: string;
  diskXml?: string;
  fileState?: FileState;
  fileError?: string;
  view?: DiagramView;
}

export function isDirty(record: DocumentRecord): boolean {
  return documentChanged(record);
}

/** Начальный XML-черновик копии входит в её точку отсчёта, но не считается сохранением. */
export function hasLocalEdits(record: DocumentRecord): boolean {
  // Совместимость с сессиями, где пустая строка обозначала несохранённый дубликат.
  const baseline = !record.path && record.savedXml === '' ? record.diskXml ?? record.sourceXml : record.savedXml;
  return (baseline !== null && record.xml !== baseline) || (record.draft ?? record.xml) !== (record.baselineDraft ?? record.xml);
}

export const hasPendingXml = (record: DocumentRecord): boolean => record.draft !== undefined && record.draft !== record.xml;

export type EditorRegistry = Map<string, BpmnEditor>;
