export type WorkspaceTab = { kind: 'document'; id: string } | { kind: 'monitor'; id: string; connectionId: string } | { kind: 'home'; id: string };
export interface TabState { tabs: WorkspaceTab[]; activeId: string }
export function reconcileDocuments(state: TabState, documentIds: string[]): TabState {
  const retained = state.tabs.filter(tab => tab.kind !== 'document' || documentIds.includes(tab.id));
  const added = documentIds.filter(id => !retained.some(tab => tab.id === id)).map(id => ({ kind: 'document' as const, id }));
  if (retained.length === state.tabs.length && !added.length) return state;
  const tabs = [...retained, ...added]; const index = state.tabs.findIndex(tab => tab.id === state.activeId);
  return { tabs, activeId: tabs.some(tab => tab.id === state.activeId) ? state.activeId : tabs[Math.max(0, index - 1)]?.id ?? tabs.at(-1)?.id ?? '' };
}
/** Исходная стартовая вкладка фиксируется до async чтения; ответ не заменяет другую вкладку. */
export function openWorkspace(state: TabState, tab: WorkspaceTab, sourceHome?: string): TabState {
  const home = state.tabs.findIndex(item => item.id === sourceHome && item.kind === 'home');
  if (state.tabs.some(item => item.id === tab.id)) return { tabs: state.tabs.filter(item => item.id !== sourceHome || item.kind !== 'home'), activeId: tab.id };
  const tabs = [...state.tabs]; if (home >= 0) tabs.splice(home, 1, tab); else tabs.push(tab);
  return { tabs, activeId: tab.id };
}
export function closeWorkspace(state: TabState, id: string): TabState {
  const index = state.tabs.findIndex(tab => tab.id === id); const tabs = state.tabs.filter(tab => tab.id !== id);
  return { tabs, activeId: state.activeId === id ? tabs[Math.max(0, index - 1)]?.id ?? tabs.at(-1)?.id ?? '' : state.activeId };
}
