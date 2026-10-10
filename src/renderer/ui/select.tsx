import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption { value: string; label: string; disabled?: boolean; action?: () => void }
/** Общий listbox с клавиатурой. Popup живёт в ближайшем dialog или body, не обрезается панелью. */
export function Select({ label, value, options, onChange, disabled, className = '', placeholder = '—', icon }: {
  label: string; value: string; options: readonly SelectOption[]; onChange: (value: string) => void;
  disabled?: boolean; className?: string; placeholder?: string; icon?: ReactNode;
}) {
  const id = useId(); const root = useRef<HTMLDivElement>(null); const trigger = useRef<HTMLButtonElement>(null); const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false); const [highlight, setHighlight] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 180, height: 260 });
  const enabled = options.map((option, index) => option.disabled ? -1 : index).filter(index => index >= 0);
  const selected = options.find(option => option.value === value);
  const typed = useRef({ value: '', time: 0 });
  const close = () => { setOpen(false); trigger.current?.focus(); };
  const choose = (index: number) => {
    const option = options[index]; if (!option || option.disabled) return;
    close(); if (option.action) option.action(); else onChange(option.value);
  };
  const show = () => {
    if (disabled) return; const index = options.findIndex(option => option.value === value && !option.disabled);
    setHighlight(index >= 0 ? index : enabled[0] ?? 0); setOpen(true);
  };
  const reposition = useCallback(() => {
    if (!trigger.current) return;
    const rect = trigger.current.getBoundingClientRect(); const width = Math.min(Math.max(180, rect.width), window.innerWidth - 16);
    const below = window.innerHeight - rect.bottom - 12; const above = rect.top - 12; const upward = below < 160 && above > below;
    const height = Math.min(280, upward ? above : below);
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)), top: upward ? rect.top - height - 6 : rect.bottom + 6, width, height });
  }, []);
  useLayoutEffect(() => { if (open) reposition(); }, [open, reposition]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false); };
    const resize = () => reposition();
    document.addEventListener('pointerdown', outside); window.addEventListener('resize', resize);
    const scroll = (event: Event) => {
      if (event.target instanceof Node && popup.current?.contains(event.target)) return;
      const rect = trigger.current?.getBoundingClientRect();
      const bounds = event.target instanceof HTMLElement ? event.target.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      if (!rect || rect.bottom < bounds.top || rect.top > bounds.bottom) setOpen(false);
      else reposition();
    };
    window.addEventListener('scroll', scroll, true);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', resize); window.removeEventListener('scroll', scroll, true); };
  }, [open, reposition]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    const container = popup.current; const item = container?.querySelector<HTMLElement>(`[data-option-index="${highlight}"]`);
    if (!open || !container || !item) return;
    // Прокручиваем только listbox: scrollIntoView мог сдвинуть внешнюю панель и закрыть popup.
    const top = item.offsetTop; const bottom = top + item.offsetHeight;
    if (top < container.scrollTop) container.scrollTop = top;
    else if (bottom > container.scrollTop + container.clientHeight) container.scrollTop = bottom - container.clientHeight;
  }, [open, highlight]);
  return <div className={`select-control ${className}`} ref={root}>
    <button type="button" className="select-trigger" ref={trigger} disabled={disabled} role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${highlight}` : undefined} data-value={value} title={selected?.label || placeholder}
      onClick={() => open ? close() : show()} onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === 'Tab') setOpen(false);
        else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); if (!open) { show(); return; }
          const index = enabled.indexOf(highlight); const next = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length;
          setHighlight(enabled[next] ?? 0);
        } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (open) choose(highlight); else show(); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault(); const now = Date.now(); typed.current = { time: now, value: (now - typed.current.time > 700 ? '' : typed.current.value) + event.key.toLocaleLowerCase() };
          const index = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(typed.current.value));
          if (index >= 0) { setHighlight(index); setOpen(true); }
        }
      }}>{icon && <span className="select-icon" aria-hidden="true">{icon}</span>}<span className="select-label">{selected?.label || placeholder}</span><ChevronDown size={14} /></button>
    {open && createPortal(<div id={id} ref={popup} className="select-options" role="listbox" aria-label={label}
      style={{ position: 'fixed', top: position.top, left: position.left, width: position.width, maxHeight: position.height }}>
      {options.map((option, index) => <button type="button" role="option" aria-selected={!option.action && option.value === value} aria-disabled={option.disabled || undefined}
        id={`${id}-${index}`} key={option.value} data-value={option.value} data-option-index={index} className={index === highlight ? 'highlighted' : ''}
        disabled={option.disabled} tabIndex={-1} title={option.label} onPointerMove={() => { if (!option.disabled) setHighlight(index); }}
        onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}><span className="select-check">{!option.action && option.value === value && <Check size={14} />}</span><span>{option.label}</span></button>)}
    </div>, trigger.current?.closest('dialog') ?? document.body)}
  </div>;
}
