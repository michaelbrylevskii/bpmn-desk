import { ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
export interface MenuCommand { label: string; action?: () => void; disabled?: boolean; icon?: ReactNode; children?: MenuCommand[]; separator?: boolean }
function MenuList({ items, x, y, owner, close, back, className = '' }: { items: MenuCommand[]; x: number; y: number; owner: string; close: () => void; back?: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null); const [submenu, setSubmenu] = useState<{ index: number; x: number; y: number }>();
  const [position, setPosition] = useState({ left: x, top: y });
  useLayoutEffect(() => {
    const box = ref.current?.getBoundingClientRect(); if (!box) return;
    setPosition({ left: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - box.height - 8)) });
    ref.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [x, y]);
  useEffect(() => {
    const place = () => { const box = ref.current?.getBoundingClientRect(); if (box) setPosition({ left: Math.max(8, Math.min(x, window.innerWidth - box.width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - box.height - 8)) }); };
    window.addEventListener('resize', place); return () => window.removeEventListener('resize', place);
  }, [x, y]);
  const open = (index: number, button: HTMLButtonElement) => {
    const box = button.getBoundingClientRect(); setSubmenu({ index, x: box.right + 230 < window.innerWidth ? box.right + 3 : box.left - 230, y: box.top });
  };
  return createPortal(<div ref={ref} role="menu" className={`command-menu select-options ${className}`} data-menu-owner={owner} style={{ position: 'fixed', ...position }} onKeyDown={event => {
    event.stopPropagation();
    const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length; buttons[next]?.focus();
    } else if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); }
    else if (event.key === 'ArrowLeft' && back) { event.preventDefault(); event.stopPropagation(); back(); }
    else if (event.key === 'ArrowRight') {
      const button = buttons[index]; const command = button && Number(button.dataset.index);
      if (button && command !== undefined && items[command]?.children) { event.preventDefault(); open(command, button); }
    }
  }}>{items.map((item, index) => item.separator ? <div role="separator" className="menu-separator" key={index} /> :
    <button type="button" role="menuitem" data-index={index} key={index} disabled={item.disabled} aria-haspopup={item.children ? 'menu' : undefined} aria-expanded={item.children ? submenu?.index === index : undefined}
      onFocus={() => { if (submenu?.index !== index) setSubmenu(undefined); }} onClick={event => { if (item.children) open(index, event.currentTarget); else { close(); item.action?.(); } }}>
      {item.icon}<span>{item.label}</span>{item.children && <ChevronRight size={14} />}</button>)}
    {submenu && items[submenu.index]?.children && <MenuList items={items[submenu.index]!.children!} x={submenu.x} y={submenu.y} owner={owner} close={close} back={() => { ref.current?.querySelector<HTMLButtonElement>(`[data-index="${submenu.index}"]`)?.focus(); setSubmenu(undefined); }} />}
  </div>, document.body);
}
export function CommandMenu({ items, x, y, close, owner, className }: { items: MenuCommand[]; x: number; y: number; close: () => void; owner: string; className?: string }) {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bpmn-desk-tooltip', { detail: owner }));
    const outside = (event: PointerEvent) => { if (event.target instanceof Element && event.target.closest('[data-menu-owner]')?.getAttribute('data-menu-owner') !== owner) close(); };
    document.addEventListener('pointerdown', outside);
    return () => { document.removeEventListener('pointerdown', outside); };
  }, [close, owner]);
  return <MenuList items={items} x={x} y={y} close={close} owner={owner} className={className} />;
}
export function MenuButton({ label, icon, items, className = '', disabled = false, menuClass }: { label: string; icon?: ReactNode; items: MenuCommand[]; className?: string; disabled?: boolean; menuClass?: string }) {
  const owner = useId(); const ref = useRef<HTMLButtonElement>(null); const [position, setPosition] = useState<{ x: number; y: number }>();
  const show = () => { const box = ref.current?.getBoundingClientRect(); if (box) setPosition({ x: box.left, y: box.bottom + 6 }); };
  const close = () => { setPosition(undefined); ref.current?.focus(); };
  return <><button ref={ref} type="button" className={`button ${className}`} data-menu-owner={owner} disabled={disabled} aria-haspopup="menu" aria-expanded={!!position} onClick={() => position ? close() : show()} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); show(); } }}>{icon}{label}<ChevronDown size={15} /></button>
    {position && <CommandMenu items={items} {...position} close={close} owner={owner} className={menuClass} />}</>;
}
