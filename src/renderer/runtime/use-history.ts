import { useCallback, useEffect, useState } from 'react';
import type { HistorySnapshot } from '../../shared/history';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';

export function useHistory(connection: string, instance: string, auto: boolean, active: boolean, revision: number) {
  const key = `${connection}\n${instance}\n${revision}`;
  const [refreshId, setRefreshId] = useState(0);
  const [state, setState] = useState<{ key: string; data?: HistorySnapshot; error?: string; busy: boolean }>({ key: '', busy: false });
  const refresh = useCallback(() => setRefreshId(value => value + 1), []);
  useEffect(() => {
    if (!connection || !instance || !active) return;
    let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, busy: true }));
      let ended = false;
      try {
        const data = await runtimeBridge().history(connection, instance); ended = !!data.instance.endTime;
        if (!disposed) setState({ key, data, busy: false });
      } catch (error) { if (!disposed) setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, error: errorMessage(error), busy: false })); }
      finally { if (!disposed && auto && !ended) timer = setTimeout(poll, 5000); }
    };
    const poll = () => { if (document.hidden) timer = setTimeout(poll, 5000); else void read(); };
    void read();
    return () => { disposed = true; clearTimeout(timer); };
  }, [connection, instance, auto, active, refreshId, key]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined,
    busy: state.key === key && state.busy, refresh };
}
