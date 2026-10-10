import { useCallback, useEffect, useRef, useState } from 'react';
import type { DefinitionSummary } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';

/** Только явное чтение. Смена версии/профиля или уход со вкладки исключает применение запоздавшего ответа. */
export function useSummary(connection: string, definition: string, revision: number, enabled: boolean) {
  const key = `${connection}\n${definition}\n${revision}`;
  const generation = useRef(0); const inFlight = useRef(false);
  const [state, setState] = useState<{ key: string; data?: DefinitionSummary; error?: string; busy: boolean }>({ key, busy: false });
  useEffect(() => {
    generation.current++;
    setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, busy: inFlight.current }));
    return () => { generation.current++; };
  }, [key, enabled]);
  const read = useCallback(async () => {
    if (!enabled || inFlight.current) return;
    const current = generation.current; inFlight.current = true;
    setState({ key, busy: true });
    try {
      const data = await runtimeBridge().summary(connection, definition);
      if (current === generation.current) setState({ key, data, busy: false });
    } catch (error) { if (current === generation.current) setState({ key, error: errorMessage(error), busy: false }); }
    finally { inFlight.current = false; setState(previous => ({ ...previous, busy: false })); }
  }, [connection, definition, enabled, key]);
  const clear = () => { generation.current++; setState({ key, busy: false }); };
  return { data: state.key === key ? state.data : undefined, busy: state.key === key && state.busy,
    error: state.key === key ? state.error : undefined, read, clear };
}
