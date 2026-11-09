import type { DesktopBridge } from '../../shared/contracts';
import { retainSessions, type WorkspaceSession } from '../../shared/sessions';
import { sessionOverview, validSession } from '../../shared/session-validation';
const key = 'bpmn-desk:sessions:v1';
const read = (): WorkspaceSession[] => {
  const records: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
  if (!Array.isArray(records) || !records.every(validSession)) throw new Error('Недопустимая сессия.');
  return records;
};
const write = (records: WorkspaceSession[]) => localStorage.setItem(key, JSON.stringify(retainSessions(records)));
export const browserSessions: Pick<DesktopBridge, 'sessions' | 'saveSession' | 'restoreSession' | 'dismissSession' | 'deleteSession' | 'setSessionPin'> = {
  sessions: async () => read().map(sessionOverview),
  saveSession: async session => {
    const records = read(); const previous = records.find(record => record.id === session.id);
    const saved = { ...session, name: previous?.name, pinned: previous?.pinned };
    write(session.tabs.some(tab => tab.kind !== 'home') || previous?.pinned ? [saved, ...records.filter(record => record.id !== session.id)] : records.filter(record => record.id !== session.id));
  },
  setSessionPin: async (id, name) => {
    if (name !== null && (!name.trim() || name.trim().length > 80)) throw new Error('Укажи имя сессии длиной от 1 до 80 символов.');
    const records = read(); const session = records.find(record => record.id === id); if (!session) throw new Error('Недопустимая сессия.');
    write([{ ...session, name: name === null ? session.name : name.trim(), pinned: name !== null }, ...records.filter(record => record.id !== id)]);
  },
  restoreSession: async (id, newWindow) => { if (newWindow) { const url = new URL(window.location.href); url.searchParams.set('session', id); window.open(url, '_blank', 'noopener'); return null; } const session = read().find(record => record.id === id); if (!session) throw new Error('Недопустимая сессия.'); return { ...session, dismissed: false }; },
  dismissSession: async id => write(read().map(record => record.id === id ? { ...record, dismissed: true } : record)),
  deleteSession: async id => write(read().filter(record => record.id !== id)),
};
