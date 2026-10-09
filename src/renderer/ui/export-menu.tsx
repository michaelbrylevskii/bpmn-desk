import { Check, ChevronDown, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DiagramExport } from '../../shared/contracts';
import { useI18n } from '../i18n/provider';

/** Split button: основной клик повторяет выбранный экспорт, меню меняет вариант. */
export function ExportMenu({ disabled, exportDiagram }: { disabled: boolean; exportDiagram: (format: DiagramExport) => void }) {
  const { t } = useI18n();
  const [format, setFormat] = useState<DiagramExport>('svg');
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const choices = [
    { id: 'svg', title: t('Экспорт SVG'), label: 'SVG' },
    { id: 'png-white', title: t('PNG · белый фон'), label: 'PNG' },
    { id: 'png-transparent', title: t('PNG · прозрачный фон'), label: 'PNG' },
  ] as const;
  const choice = choices.find(choice => choice.id === format)!;
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div className="export-menu" ref={root}>
    <button className="button ghost export-primary" disabled={disabled} title={choice.title} onClick={() => exportDiagram(format)}><Download size={16} />{choice.label}</button>
    <button ref={toggle} className="icon-button export-toggle" disabled={disabled} title={t('Формат экспорта')} aria-label={t('Формат экспорта')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}><ChevronDown size={13} /></button>
    {open && <div className="export-options" role="menu" aria-label={t('Формат экспорта')} onKeyDown={event => {
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[index]?.focus();
      } else if (event.key === 'Tab') setOpen(false);
    }}>
      {choices.map(option => <button role="menuitem" key={option.id} onClick={() => { setFormat(option.id); setOpen(false); toggle.current?.focus(); exportDiagram(option.id); }}>
        <span className="export-check">{format === option.id && <Check size={14} />}</span>{option.id === 'svg' ? 'SVG' : option.title}
      </button>)}
    </div>}
  </div>;
}
