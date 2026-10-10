import { House, Server, Workflow, X } from 'lucide-react';
import type { Connection } from '../../shared/runtime';
import type { DocumentRecord } from '../documents/types';
import { isDirty } from '../documents/types';
import { useI18n } from '../i18n/provider';
import type { MonitorControls } from '../runtime/controls';
import type { WorkspaceTab } from './use-tabs';
export function Tabs({ tabs, activeId, documents, connections, controls, activate, close, create }: {
  tabs: WorkspaceTab[]; activeId: string; documents: DocumentRecord[]; connections: Connection[]; controls: Record<string, MonitorControls>;
  activate: (id: string) => void; close: (tab: WorkspaceTab) => void; create: () => void;
}) {
  const { t } = useI18n();
  if (!tabs.length) return null;
  return <nav className="document-tabs" role="tablist" aria-label={t('Открытые вкладки')} onKeyDown={event => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key) || !(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
    event.preventDefault(); const index = tabs.findIndex(tab => tab.id === activeId);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    const target = tabs[next]; if (target) { activate(target.id); event.currentTarget.querySelector<HTMLButtonElement>(`[data-tab-id="${target.id}"]`)?.focus(); }
  }}>{tabs.map(tab => {
    const document = documents.find(item => item.id === tab.id); const connection = tab.kind === 'monitor' ? connections.find(item => item.id === tab.connectionId) : undefined;
    const title = tab.kind === 'home' ? t('Новая вкладка') : tab.kind === 'document' ? document?.name ?? '' : `${controls[tab.id]?.title || t('Состояние процессов')} · ${connection?.name || t('Выбери подключение')}`;
    return <div key={tab.id} className={`document-tab ${tab.id === activeId ? 'active' : ''}`} data-kind={tab.kind}>
      <button role="tab" data-tab-id={tab.id} aria-selected={tab.id === activeId} title={document?.path || title} onClick={() => activate(tab.id)} tabIndex={tab.id === activeId ? 0 : -1}>
        {tab.kind === 'home' ? <House size={14} /> : tab.kind === 'monitor' ? <Server size={14} /> : <Workflow size={14} />}<span>{title}</span>{document && isDirty(document) && <i className="dirty-dot" aria-label={t('Несохранённые изменения')} />}</button>
      <button title={t('Закрыть {name}', { name: title })} onClick={() => close(tab)}><X size={13} /></button>
    </div>;
  })}<button className="new-tab" title={t('Новая вкладка')} onClick={create}>+</button></nav>;
}
