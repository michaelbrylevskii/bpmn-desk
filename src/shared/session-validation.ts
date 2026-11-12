import type { WorkspaceSession, SessionOverview, SessionDocument, SessionMonitor } from './sessions';
import { documentChanged } from './sessions';
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const xml = (value: unknown): value is string => typeof value === 'string' && value.length <= 20 * 1024 * 1024;
const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
export function validMonitor(value: unknown): value is SessionMonitor {
  if (!object(value) || typeof value.definitionId !== 'string' || typeof value.instanceId !== 'string' || typeof value.history !== 'boolean') return false;
  if (!optionalString(value.jobId) || !optionalString(value.historyFilter) || !optionalString(value.title) || !optionalString(value.selected) || !['auto', 'catalogHidden', 'detailsHidden'].every(key => value[key] === undefined || typeof value[key] === 'boolean')) return false;
  if (value.catalog !== undefined) {
    const catalog = value.catalog;
    if (!object(catalog) || !['definitions', 'runtime', 'history', 'jobs'].includes(String(catalog.kind)) || !object(catalog.queries)) return false;
    if (catalog.scope !== undefined && (!object(catalog.scope) || typeof catalog.scope.id !== 'string' || typeof catalog.scope.label !== 'string')) return false;
    for (const [kind, query] of Object.entries(catalog.queries)) {
      if (!['definitions', 'runtime', 'history', 'jobs'].includes(kind) || !object(query) || !Object.values(query).every(value => value === undefined || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value))) return false;
    }
  }
  return true;
}
export function validDocument(value: unknown): value is SessionDocument {
  if (!object(value) || !['id', 'name', 'path'].every(key => typeof value[key] === 'string') || !optionalString(value.token)) return false;
  if (value.guardXml !== undefined && !xml(value.guardXml)) return false;
  if (value.baselineDraft !== undefined && !xml(value.baselineDraft)) return false;
  if (!xml(value.xml) || !xml(value.diskXml) || value.savedXml !== null && !xml(value.savedXml) || value.draft !== undefined && !xml(value.draft)) return false;
  return value.view === undefined || object(value.view) && ['x', 'y', 'width', 'height'].every(key => typeof value.view === 'object' && value.view !== null && key in value.view && typeof Reflect.get(value.view, key) === 'number' && Number.isFinite(Reflect.get(value.view, key))) && Number(value.view.width) > 0 && Number(value.view.height) > 0 && optionalString(value.view.selected);
}
export function validSession(value: unknown): value is WorkspaceSession {
  if (!object(value) || typeof value.id !== 'string' || !/^[\w-]{1,80}$/.test(value.id) || typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt)) || typeof value.dismissed !== 'boolean' || typeof value.activeId !== 'string') return false;
  if (!Array.isArray(value.documents) || !value.documents.every(validDocument) || !Array.isArray(value.tabs)) return false;
  if (value.name !== undefined && (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) || value.pinned !== undefined && typeof value.pinned !== 'boolean' || value.pinned === true && !value.name) return false;
  const ids = new Set<string>();
  const documents: SessionDocument[] = value.documents;
  return value.tabs.every(tab => {
    if (!object(tab) || typeof tab.id !== 'string' || ids.has(tab.id)) return false;
    ids.add(tab.id);
    return tab.kind === 'home' || tab.kind === 'document' && documents.some(document => document.id === tab.id) || tab.kind === 'monitor' && typeof tab.connectionId === 'string' && (tab.monitor === undefined || validMonitor(tab.monitor));
  }) && new Set(documents.map(document => document.id)).size === documents.length;
}
export function sessionOverview(session: WorkspaceSession): SessionOverview {
  return { id: session.id, name: session.name, pinned: session.pinned, updatedAt: session.updatedAt, dismissed: session.dismissed, tabs: session.tabs.filter(tab => tab.kind !== 'home').map(tab => {
    const document = session.documents.find(document => document.id === tab.id);
    return { name: document?.name ?? '', context: tab.kind === 'monitor' ? tab.monitor?.title : undefined, connectionId: tab.kind === 'monitor' ? tab.connectionId : undefined, kind: tab.kind, dirty: !!document && documentChanged(document) };
  }) };
}
