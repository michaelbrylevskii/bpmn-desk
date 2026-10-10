import { FilePlus2, ChevronDown, Workflow } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DocumentProfile } from '../engines/contracts';
import { useI18n } from '../i18n/provider';
/** Меню команд создания: выбор сразу создаёт документ, отдельного значения Select здесь нет. */
export function CreateDiagramMenu({ create }: { create: (profile: DocumentProfile) => void }) {
  const { t } = useI18n(); const id = useId(); const trigger = useRef<HTMLButtonElement>(null); const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false); const [position, setPosition] = useState({ left: 0, top: 0 });
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useLayoutEffect(() => {
    if (!open) return;
    const reposition = () => { const rect = trigger.current?.getBoundingClientRect(); if (rect) setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 248)), top: rect.bottom + 166 < window.innerHeight ? rect.bottom + 6 : Math.max(8, rect.top - 160) }); };
    reposition(); popup.current?.querySelector<HTMLButtonElement>('button')?.focus();
    window.addEventListener('resize', reposition); window.addEventListener('scroll', reposition, true);
    return () => { window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !trigger.current?.contains(event.target) && !popup.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <><button ref={trigger} className="button create-diagram-button" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
    onClick={() => setOpen(value => !value)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }}>
    <FilePlus2 size={18} />{t('Создать схему')}<ChevronDown size={15} /></button>
    {open && createPortal(<div ref={popup} id={id} className="create-diagram-options select-options" role="menu" aria-label={t('Тип новой схемы')} style={{ position: 'fixed', ...position }} onKeyDown={event => {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button')); const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      } else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
      else if (event.key === 'Tab') close();
    }}>
      {([{ id: 'bpmn', title: 'BPMN 2.0' }, { id: 'flowable', title: 'Flowable' }, { id: 'camunda7', title: 'Camunda 7' }] as const).map(profile =>
        <button role="menuitem" key={profile.id} onClick={() => { close(); create(profile.id); }}><Workflow size={16} data-profile={profile.id} />{profile.title}</button>)}
    </div>, document.body)}
  </>;
}
