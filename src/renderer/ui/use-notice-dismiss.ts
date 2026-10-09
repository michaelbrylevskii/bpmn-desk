import { useEffect, useRef, useState } from 'react';

const FADE_MS = 200;
const RESUME_DELAY_MS = 1500;

/** Сохраняет остаток времени; после взаимодействия ждёт перед возобновлением. */
export function useNoticeDismiss(duration: number, paused: boolean, close: () => void): boolean {
  const [fading, setFading] = useState(false);
  const remaining = useRef(duration);
  const interacted = useRef(false);
  const callback = useRef(close); callback.current = close;
  useEffect(() => {
    if (paused) { interacted.current = true; setFading(false); return; }
    const delay = interacted.current ? RESUME_DELAY_MS : 0;
    interacted.current = false;
    const started = performance.now();
    const fade = window.setTimeout(() => setFading(true), delay + Math.max(0, remaining.current - FADE_MS));
    const dismiss = window.setTimeout(() => callback.current(), delay + remaining.current);
    return () => {
      window.clearTimeout(fade); window.clearTimeout(dismiss);
      remaining.current = Math.max(0, remaining.current - Math.max(0, performance.now() - started - delay));
    };
  }, [duration, paused]);
  return fading && !paused;
}
