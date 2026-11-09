import { useCallback, useReducer } from 'react';
import { navigateMonitor } from './navigation-model';

export function useMonitorNavigation(initial?: import('../../shared/sessions').SessionMonitor) {
  const [state, dispatch] = useReducer(navigateMonitor, { past: [], future: [], current: initial && (initial.instanceId || initial.definitionId) ? { definitionId: initial.definitionId, instanceId: initial.instanceId, history: initial.history, destination: { kind: initial.instanceId ? 'instance' : 'definition', id: initial.instanceId || initial.definitionId, name: initial.instanceId || initial.definitionId } } : undefined });
  const setHistoryMode = useCallback((history: boolean) => dispatch({ type: 'mode', history }), []);
  return { ...state, dispatch, setHistoryMode };
}
