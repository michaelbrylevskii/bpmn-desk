import { useCallback, useEffect, useRef, useState } from 'react';
export type WorkspaceTab = { kind: 'document'; id: string } | { kind: 'monitor'; id: string; connectionId: string };

/** Общий порядок и выбор вкладок; документы и мониторы сохраняют собственные модели. */
export function useTabs(documentIds: string[], openedId: string, revision: number) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>([]); const [activeId, setActiveId] = useState(''); const lastRevision = useRef(-1);
  useEffect(() => {
    setTabs(previous => {
      const next = previous.filter(tab => tab.kind === 'monitor' || documentIds.includes(tab.id));
      const added = documentIds.filter(id => !next.some(tab => tab.id === id)).map(id => ({ kind: 'document' as const, id }));
      if (next.length === previous.length && !added.length) return previous;
      const result = [...next, ...added];
      setActiveId(current => result.some(tab => tab.id === current) ? current : result[Math.max(0, previous.findIndex(tab => tab.id === current) - 1)]?.id ?? result.at(-1)?.id ?? '');
      return result;
    });
  }, [documentIds]);
  useEffect(() => {
    if (lastRevision.current === revision) return; lastRevision.current = revision;
    if (openedId) setActiveId(openedId);
  }, [openedId, revision]);
  const createMonitor = useCallback((connectionId: string) => {
    const id = crypto.randomUUID(); setTabs(previous => [...previous, { kind: 'monitor', id, connectionId }]); setActiveId(id);
  }, []);
  const closeMonitor = useCallback((id: string) => {
    setTabs(previous => {
      const index = previous.findIndex(tab => tab.id === id); const next = previous.filter(tab => tab.id !== id);
      setActiveId(current => current === id ? next[Math.max(0, index - 1)]?.id ?? next.at(-1)?.id ?? '' : current); return next;
    });
  }, []);
  const changeConnection = useCallback((id: string, connectionId: string) => setTabs(previous => previous.map(tab => tab.id === id && tab.kind === 'monitor' ? { ...tab, connectionId } : tab)), []);
  return { tabs, activeId, activate: setActiveId, createMonitor, closeMonitor, changeConnection };
}
