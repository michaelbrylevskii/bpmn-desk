import { useCallback, useEffect, useRef, useState } from 'react';
import type { DefinitionSummary } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';

/** Очередь принадлежит монитору: смена версии не запускает ещё одну сводку до завершения прежней. */
export function useSummary(connection: string, definition: string, revision: number, enabled: boolean, autoLoad: boolean, auto: boolean) {
  const key = `${connection}\n${definition}\n${revision}`;
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [request, setRequest] = useState({ key: '', revision: 0 });
  const [state, setState] = useState<{ key: string; data?: DefinitionSummary; error?: string; busy: boolean }>({ key, busy: false });
  const read = useCallback(() => setRequest(previous => ({ key, revision: previous.revision + 1 })), [key]);
  useEffect(() => {
    if (!enabled || !autoLoad && request.key !== key) return;
    let disposed = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = () => {
      if (disposed) return;
      // Скрытое окно не инициирует новые чтения, включая первое автоматическое.
      if (document.hidden) { timer = setTimeout(poll, 5000); return; }
      setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, error: previous.key === key ? previous.error : undefined, busy: true }));
      let deferred = false;
      const task = queue.current.then(async () => {
        if (disposed) return;
        if (document.hidden) { deferred = true; return; }
        try {
          const data = await runtimeBridge().summary(connection, definition);
          if (data.executions.error && data.deadLetters.error) throw new Error([...new Set([data.executions.error, data.deadLetters.error])].join('\n'));
          if (!disposed) setState({ key, data, busy: false });
        } catch (error) {
          if (!disposed) setState(previous => ({ key, data: previous.key === key ? previous.data : undefined, error: errorMessage(error), busy: false }));
        }
      });
      queue.current = task.catch(() => undefined);
      void task.finally(() => { if (!disposed && deferred) timer = setTimeout(poll, 5000); });
    };
    poll();
    return () => { disposed = true; clearTimeout(timer); };
  }, [connection, definition, key, enabled, autoLoad, request]);
  useEffect(() => {
    if (!enabled || !auto || !autoLoad && request.key !== key || state.key !== key || state.busy) return;
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => { if (document.hidden) timer = setTimeout(poll, 5000); else read(); };
    timer = setTimeout(poll, 5000);
    return () => clearTimeout(timer);
  }, [enabled, auto, autoLoad, request.key, key, state, read]);
  return { data: state.key === key ? state.data : undefined, busy: enabled && state.key === key && state.busy,
    error: state.key === key ? state.error : undefined, read };
}
