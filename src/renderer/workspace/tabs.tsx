import { CommandMenu, type MenuCommand } from '../ui/command-menu';
import { Tooltip } from '../ui/tooltip';
import { ChevronLeft, ChevronRight, House, Server, Workflow, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { Connection } from '../../shared/runtime';
import type { DocumentRecord } from '../documents/types';
import { isDirty } from '../documents/types';
import { useI18n } from '../i18n/provider';
import type { MonitorControls } from '../runtime/controls';
import type { WorkspaceTab } from './use-tabs';
import { useTabScroll } from './use-tab-scroll';
export function Tabs({ tabs, activeId, documents, connections, controls, activate, move, close, create, menu }: {
  tabs: WorkspaceTab[]; activeId: string; documents: DocumentRecord[]; connections: Connection[]; controls: Record<string, MonitorControls>;
  activate: (id: string) => void; close: (tab: WorkspaceTab) => void; create: () => void;
  menu: (tab: WorkspaceTab) => MenuCommand[];
  move: (id: string, targetId: string, after: boolean) => void;
}) {
  const { t } = useI18n();
  const owner = useId(); const [context, setContext] = useState<{ tab: WorkspaceTab; x: number; y: number }>();
  const dragged = useRef<string | undefined>(undefined);
  const [drop, setDrop] = useState<{ id: string; after: boolean }>();
  const scroller = useRef<HTMLElement>(null); const scroll = useTabScroll(scroller, activeId, tabs.map(tab => tab.id).join(','));
  if (!tabs.length) return null;
  return <><div className="tab-strip"><button className="tab-scroll" aria-label={t('Прокрутить вкладки влево')} title={t('Прокрутить вкладки влево')} disabled={!scroll.left} onClick={() => scroll.scroll(-1)}><ChevronLeft size={16} /></button>
    <div className={`tab-scroll-region ${scroll.left ? 'has-left' : ''} ${scroll.right ? 'has-right' : ''}`}><nav ref={scroller} className="document-tabs" role="tablist" aria-label={t('Открытые вкладки')} onDragOver={event => {
      if (!dragged.current) return;
      const element = event.currentTarget; const box = element.getBoundingClientRect();
      if (event.clientX < box.left + 35) element.scrollLeft -= 28;
      else if (event.clientX > box.right - 35) element.scrollLeft += 28;
    }} onKeyDown={event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key) || !(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
    event.preventDefault(); const index = tabs.findIndex(tab => tab.id === activeId);
    if (event.ctrlKey && event.shiftKey && ['ArrowRight', 'ArrowLeft'].includes(event.key)) {
      const target = tabs[index + (event.key === 'ArrowRight' ? 1 : -1)];
      if (target) move(activeId, target.id, event.key === 'ArrowRight');
      return;
    }
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const target = tabs[next]; if (target) { activate(target.id); event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab-id="${target.id}"]`)?.focus(); }
  }}>{tabs.map(tab => {
    const document = documents.find(item => item.id === tab.id); const connection = tab.kind === 'monitor' ? connections.find(item => item.id === tab.connectionId) : undefined;
    const title = tab.kind === 'home' ? t('Новая вкладка') : tab.kind === 'document' ? document?.name ?? '' : `${controls[tab.id]?.title || tab.monitor?.title || t('Состояние процессов')} · ${connection?.name || t('Выбери подключение')}`;
    const external = document?.fileState && document.fileState !== 'unchanged';
    const dirty = document && isDirty(document);
    const state = external ? dirty ? 'conflict' : 'external' : dirty ? 'local' : '';
    const detail = <div className="tab-tooltip"><strong>{title}</strong>{document?.path && <div className="file-path">{document.path}</div>}{dirty && <div>{t('Есть несохранённые изменения')}</div>}{document?.draft !== undefined && document.draft !== document.xml && <div>{t('Неприменённые изменения XML')}</div>}{external && <div>{t(document.fileState === 'missing' ? 'Файл удалён с диска.' : document.fileState === 'unavailable' ? 'Не удалось проверить файл на диске.' : 'Файл изменён на диске.')}</div>}{document?.fileError && <div>{document.fileError}</div>}</div>;
    return <Tooltip key={tab.id} content={detail}><div className={`document-tab ${tab.id === activeId ? 'active' : ''} ${drop?.id === tab.id ? drop.after ? 'drop-after' : 'drop-before' : ''}`} data-kind={tab.kind} onContextMenu={event => { event.preventDefault(); setContext({ tab, x: event.clientX, y: event.clientY }); }}
      onDragOver={event => {
        if (!dragged.current || dragged.current === tab.id) return;
        event.preventDefault(); event.dataTransfer.dropEffect = 'move';
        const bounds = event.currentTarget.getBoundingClientRect();
        setDrop({ id: tab.id, after: event.clientX > bounds.left + bounds.width / 2 });
      }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDrop(undefined); }}
      onDrop={event => {
        if (!dragged.current) return;
        event.preventDefault(); event.stopPropagation();
        const bounds = event.currentTarget.getBoundingClientRect();
        move(dragged.current, tab.id, event.clientX > bounds.left + bounds.width / 2);
        dragged.current = undefined; setDrop(undefined);
      }}>
      <button role="tab" draggable data-tab-id={tab.id} aria-selected={tab.id === activeId} onClick={() => activate(tab.id)} tabIndex={tab.id === activeId ? 0 : -1}
        onDragStart={event => { dragged.current = tab.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-bpmn-desk-tab', tab.id); }}
        onDragEnd={() => { dragged.current = undefined; setDrop(undefined); }}>
        {tab.kind === 'home' ? <House size={14} /> : tab.kind === 'monitor' ? <Server size={14} /> : <Workflow size={14} />}<span>{title}</span>{state && <i className={`dirty-dot ${state}`} aria-label={t(external ? document.fileState === 'missing' ? 'Файл удалён с диска.' : 'Файл изменён на диске.' : 'Несохранённые изменения')} />}</button>
      <button title={t('Закрыть {name}', { name: title })} onClick={() => close(tab)}><X size={13} /></button>
    </div></Tooltip>;
  })}</nav></div><button className="tab-scroll" aria-label={t('Прокрутить вкладки вправо')} title={t('Прокрутить вкладки вправо')} disabled={!scroll.right} onClick={() => scroll.scroll(1)}><ChevronRight size={16} /></button><button className="new-tab" title={t('Новая вкладка')} onClick={create}>+</button></div>{context && <CommandMenu items={menu(context.tab)} x={context.x} y={context.y} owner={owner} close={() => setContext(undefined)} />}</>;
}
