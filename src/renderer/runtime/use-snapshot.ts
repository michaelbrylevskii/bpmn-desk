import { useCallback, useEffect, useState } from 'react';
import type { InstanceSnapshot } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';

export function useSnapshot(connection: string, instance: string, auto: boolean, active: boolean) {
  const key = `${connection}\n${instance}`;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{ key: string; data?: InstanceSnapshot; error?: string; busy: boolean }>({ key: '', busy: false });
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    if (!connection || !instance || !active) return;
    let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, busy: true }));
      try {
        const data = await runtimeBridge().snapshot(connection, instance);
        if (!disposed) setState({ key, data, busy: false });
      } catch (error) { if (!disposed) setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, error: errorMessage(error), busy: false })); }
      finally { if (!disposed && auto) timer = setTimeout(poll, 5000); }
    };
    const poll = () => { if (document.hidden) timer = setTimeout(poll, 5000); else void read(); };
    void read();
    return () => { disposed = true; clearTimeout(timer); };
  }, [connection, instance, auto, active, revision, key]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key ? state.error : undefined,
    busy: state.key === key && state.busy, refresh };
}
