import { useCallback, useEffect, useRef, useState } from 'react';
import { closeWorkspace, moveWorkspace, openWorkspace, reconcileDocuments, type TabState } from './tab-state';
export type { WorkspaceTab } from './tab-state';
/** Порядок вкладок; модели документов и мониторов независимы от стартовой страницы. */
export function useTabs(documentIds: string[], openedId: string, revision: number) {
  const [state, setState] = useState<TabState>({ tabs: [], activeId: '' }); const lastRevision = useRef(-1);
  useEffect(() => {
    const activate = lastRevision.current !== revision; lastRevision.current = revision;
    setState(previous => { const next = reconcileDocuments(previous, documentIds);
      return activate && documentIds.includes(openedId) ? { ...next, activeId: openedId } : next; });
  }, [documentIds, openedId, revision]);
  const createHome = useCallback(() => setState(previous => openWorkspace(previous, { kind: 'home', id: crypto.randomUUID() })), []);
  const documentOpened = useCallback((id: string, sourceHome?: string) => setState(previous => openWorkspace(previous, { kind: 'document', id }, sourceHome)), []);
  const createMonitor = useCallback((connectionId: string, sourceHome?: string) => setState(previous => openWorkspace(previous, { kind: 'monitor', id: crypto.randomUUID(), connectionId }, sourceHome)), []);
  const closeTab = useCallback((id: string) => setState(previous => closeWorkspace(previous, id)), []);
  const activate = useCallback((activeId: string) => setState(previous => ({ ...previous, activeId })), []);
  const move = useCallback((id: string, targetId: string, after: boolean) => setState(previous => moveWorkspace(previous, id, targetId, after)), []);
  const changeConnection = useCallback((id: string, connectionId: string) => setState(previous => ({ ...previous, tabs: previous.tabs.map(tab => tab.id === id && tab.kind === 'monitor' ? { ...tab, connectionId } : tab) })), []);
  return { ...state, activate, move, createHome, documentOpened, createMonitor, closeTab, changeConnection };
}
