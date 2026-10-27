import { House, Server, Workflow, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Connection } from '../../shared/runtime';
import type { DocumentRecord } from '../documents/types';
import { isDirty } from '../documents/types';
import { useI18n } from '../i18n/provider';
import type { MonitorControls } from '../runtime/controls';
import type { WorkspaceTab } from './use-tabs';
export function Tabs({ tabs, activeId, documents, connections, controls, activate, move, close, create }: {
  tabs: WorkspaceTab[]; activeId: string; documents: DocumentRecord[]; connections: Connection[]; controls: Record<string, MonitorControls>;
  activate: (id: string) => void; close: (tab: WorkspaceTab) => void; create: () => void;
  move: (id: string, targetId: string, after: boolean) => void;
}) {
  const { t } = useI18n();
  const dragged = useRef<string | undefined>(undefined);
  const [drop, setDrop] = useState<{ id: string; after: boolean }>();
  if (!tabs.length) return null;
  return <nav className="document-tabs" role="tablist" aria-label={t('Открытые вкладки')} onKeyDown={event => {
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
    const title = tab.kind === 'home' ? t('Новая вкладка') : tab.kind === 'document' ? document?.name ?? '' : `${controls[tab.id]?.title || t('Состояние процессов')} · ${connection?.name || t('Выбери подключение')}`;
    return <div key={tab.id} className={`document-tab ${tab.id === activeId ? 'active' : ''} ${drop?.id === tab.id ? drop.after ? 'drop-after' : 'drop-before' : ''}`} data-kind={tab.kind}
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
      <button role="tab" draggable data-tab-id={tab.id} aria-selected={tab.id === activeId} title={document?.path || title} onClick={() => activate(tab.id)} tabIndex={tab.id === activeId ? 0 : -1}
        onDragStart={event => { dragged.current = tab.id; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-bpmn-desk-tab', tab.id); }}
        onDragEnd={() => { dragged.current = undefined; setDrop(undefined); }}>
        {tab.kind === 'home' ? <House size={14} /> : tab.kind === 'monitor' ? <Server size={14} /> : <Workflow size={14} />}<span>{title}</span>{document && isDirty(document) && <i className="dirty-dot" aria-label={t('Несохранённые изменения')} />}</button>
      <button title={t('Закрыть {name}', { name: title })} onClick={() => close(tab)}><X size={13} /></button>
    </div>;
  })}<button className="new-tab" title={t('Новая вкладка')} onClick={create}>+</button></nav>;
}
