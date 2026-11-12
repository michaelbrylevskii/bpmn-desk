import type { FileState } from '../../shared/contracts';
import type { DiagramView } from '../../shared/sessions';
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
  snapshot?: EditorSnapshot;
  guardXml?: string;
  diskXml?: string;
  fileState?: FileState;
  fileError?: string;
  view?: DiagramView;
}

export function isDirty(record: DocumentRecord): boolean {
  return !record.path || (record.savedXml !== null && record.xml !== record.savedXml) || (record.draft !== undefined && record.draft !== record.xml);
}

/** Копия требует сохранения сразу, но до правок совпадает со своим исходным снимком. */
export function hasLocalEdits(record: DocumentRecord): boolean {
  const baseline = !record.path && record.savedXml === '' ? record.diskXml ?? record.sourceXml : record.savedXml;
  return (baseline !== null && record.xml !== baseline) || (record.draft !== undefined && record.draft !== record.xml);
}

export type EditorRegistry = Map<string, BpmnEditor>;
