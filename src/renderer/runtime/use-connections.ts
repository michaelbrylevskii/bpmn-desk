import { useCallback, useEffect, useRef, useState } from 'react';
import type { Connections } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
const selectionKey = 'bpmn-desk:runtime-connection';
export function useConnections(enabled: boolean) {
  const [data, setData] = useState<Connections>({ items: [], secureStorage: false }); const [preferredId, setPreferredId] = useState(() => localStorage.getItem(selectionKey) ?? '');
  const remember = useCallback((id: string) => { setPreferredId(id); localStorage.setItem(selectionKey, id); }, []); const [error, setError] = useState('');
  const [revisions, setRevisions] = useState<Record<string, number>>({});
  const loaded = useRef(false); const [ready, setReady] = useState(false);
  const refresh = useCallback(async (id?: string) => { const data = await runtimeBridge().connections(); setData(data); setReady(true); setError(''); if (id) { remember(id); setRevisions(previous => ({ ...previous, [id]: (previous[id] ?? 0) + 1 })); } }, [remember]);
  useEffect(() => {
    if (!enabled || loaded.current || !window.runtime) return; loaded.current = true;
    void refresh().catch(error => { loaded.current = false; setError(errorMessage(error)); });
  }, [enabled, refresh]);
  return { data, preferredId, revisions, remember, error, refresh, ready };
}
