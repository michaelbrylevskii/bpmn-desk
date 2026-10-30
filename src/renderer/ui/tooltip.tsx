import { cloneElement, useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Подсказка доступна с клавиатуры, закрывается Escape и не обрезается панелями. */
export function Tooltip({ children, content }: { children: ReactElement<{ 'aria-describedby'?: string }>; content: ReactNode }) {
  const id = useId(); const anchor = useRef<HTMLSpanElement>(null); const popup = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false); const [position, setPosition] = useState({ left: 0, top: 0 });
  const show = () => { clearTimeout(timer.current); setOpen(true); };
  const hide = () => { timer.current = setTimeout(() => setOpen(false), 120); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!anchor.current || !popup.current) return;
      const box = anchor.current.getBoundingClientRect(); const tip = popup.current.getBoundingClientRect();
      setPosition({ left: Math.max(8, Math.min(window.innerWidth - tip.width - 8, box.left + box.width / 2 - tip.width / 2)),
        top: box.bottom + tip.height + 8 < window.innerHeight ? box.bottom + 6 : Math.max(8, box.top - tip.height - 6) });
    };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { clearTimeout(timer.current); setOpen(false); } };
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true); window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); window.removeEventListener('keydown', escape); };
  }, [open, content]);
  return <span className="tooltip-anchor" ref={anchor} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
    {cloneElement(children, { 'aria-describedby': open ? id : undefined })}
    {open && createPortal(<div id={id} role="tooltip" className="app-tooltip" ref={popup} style={position} onMouseEnter={show} onMouseLeave={hide}>{content}</div>, document.body)}
  </span>;
}
