import type { DesktopBridge } from '../../shared/contracts';
import { sessionLimit, type WorkspaceSession } from '../../shared/sessions';
import { sessionOverview, validSession } from '../../shared/session-validation';
const key = 'bpmn-desk:sessions:v1';
const read = (): WorkspaceSession[] => {
  const records: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
  if (!Array.isArray(records) || !records.every(validSession)) throw new Error('Недопустимая сессия.');
  return records;
};
const write = (records: WorkspaceSession[]) => localStorage.setItem(key, JSON.stringify(records.slice(0, sessionLimit)));
export const browserSessions: Pick<DesktopBridge, 'sessions' | 'saveSession' | 'restoreSession' | 'dismissSession' | 'deleteSession'> = {
  sessions: async () => read().map(sessionOverview),
  saveSession: async session => write(session.tabs.some(tab => tab.kind !== 'home') ? [session, ...read().filter(record => record.id !== session.id)] : read().filter(record => record.id !== session.id)),
  restoreSession: async (id, newWindow) => { if (newWindow) { const url = new URL(window.location.href); url.searchParams.set('session', id); window.open(url, '_blank', 'noopener'); return null; } const session = read().find(record => record.id === id); if (!session) throw new Error('Недопустимая сессия.'); return { ...session, dismissed: false }; },
  dismissSession: async id => write(read().map(record => record.id === id ? { ...record, dismissed: true } : record)),
  deleteSession: async id => write(read().filter(record => record.id !== id)),
};
