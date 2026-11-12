import type { HistoryQuery } from './history';

export interface DiagramView { x: number; y: number; width: number; height: number; selected?: string }
export interface SessionDocument {
  id: string; name: string; path: string; token?: string;
  xml: string; guardXml?: string; diskXml: string; savedXml: string | null; draft?: string; baselineDraft?: string; view?: DiagramView;
}
export interface SessionMonitor {
  definitionId: string; instanceId: string; history: boolean; selected?: string; title?: string; historyFilter?: string; jobId?: string;
  catalog?: { kind: 'definitions' | 'runtime' | 'history' | 'jobs'; scope?: { id: string; label: string }; queries: Partial<Record<'definitions' | 'runtime' | 'history' | 'jobs', HistoryQuery>> };
  catalogHidden?: boolean; detailsHidden?: boolean; auto?: boolean;
}
export type SessionTab = { kind: 'document'; id: string } | { kind: 'monitor'; id: string; connectionId: string; monitor?: SessionMonitor } | { kind: 'home'; id: string };
export interface SessionLabel { name?: string; pinned?: boolean }
export interface WorkspaceSession extends SessionLabel {
  id: string; updatedAt: string; dismissed: boolean; tabs: SessionTab[]; activeId: string; documents: SessionDocument[];
}
export interface SessionOverview extends SessionLabel { open?: boolean; id: string; updatedAt: string; dismissed: boolean; tabs: { name: string; kind: SessionTab['kind']; dirty: boolean; connectionId?: string; context?: string }[] }
export const sessionLimit = 15;
export const retainSessions = <T extends SessionLabel>(records: T[]): T[] => [...records.filter(record => record.pinned), ...records.filter(record => !record.pinned).slice(0, sessionLimit)];
export const documentChanged = (document: Pick<SessionDocument, 'path' | 'xml' | 'savedXml' | 'draft'>): boolean =>
  !document.path || document.savedXml !== null && document.xml !== document.savedXml || document.draft !== undefined && document.draft !== document.xml;
