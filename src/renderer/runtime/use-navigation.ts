import { useCallback, useReducer } from 'react';
import { navigateMonitor } from './navigation-model';

export function useMonitorNavigation() {
  const [state, dispatch] = useReducer(navigateMonitor, { past: [], future: [] });
  const setHistoryMode = useCallback((history: boolean) => dispatch({ type: 'mode', history }), []);
  return { ...state, dispatch, setHistoryMode };
}
