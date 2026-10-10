import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Connection, ConnectionInput, Connections } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';
import { ConnectionForm } from './connection-form';

export function ConnectionsDialog({ connections, initialId, close, changed }: { connections: Connections; initialId: string; close: () => void; changed: (selected?: string) => Promise<void> }) {
  const { t, text } = useI18n(); const dialog = useRef<HTMLDialogElement>(null);
  const [items, setItems] = useState(connections.items); const [selected, setSelected] = useState<string>(initialId);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const current = items.find(item => item.id === selected);
  useEffect(() => { dialog.current?.showModal(); const node = dialog.current; return () => node?.close(); }, []);
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); setSuccess(''); try { await action(); } catch (error) { setError(errorMessage(error)); } finally { setBusy(false); } };
  const save = (input: ConnectionInput) => void run(async () => {
    const item = await runtimeBridge().saveConnection(input);
    await changed(item.id); close();
  });
  const remove = (item: Connection) => void run(async () => {
    if (!window.confirm(t('Удалить подключение?'))) return;
    await runtimeBridge().deleteConnection(item.id);
    const next = await runtimeBridge().connections(); setItems(next.items); setSelected(next.items[0]?.id ?? ''); await changed();
  });
  return <dialog className="connections-dialog" ref={dialog} aria-labelledby="connections-title" onClose={close}>
    <div className="panel-heading"><h2 id="connections-title">{t('Управление подключениями')}</h2><button className="icon-button" title={t('Закрыть')} onClick={close}><X size={18} /></button></div>
    <div className="connections-body"><aside><button className="button" disabled={busy} onClick={() => { setSelected(''); setError(''); }}><Plus size={16} />{t('Новое подключение')}</button>
      {items.map(item => <button key={item.id} className={`connection-item ${selected === item.id ? 'selected' : ''}`} disabled={busy} onClick={() => { setSelected(item.id); setError(''); setSuccess(''); }}><strong>{item.name}</strong><small>{item.baseUrl}</small></button>)}</aside>
      <div><ConnectionForm key={selected} connection={current} secure={connections.secureStorage} busy={busy} save={save} edited={() => { setError(''); setSuccess(''); }} test={input => void run(async () => { await runtimeBridge().testConnectionDraft(input); setSuccess(t('Подключение проверено.')); })} />
        {current && <div className="runtime-actions">
          <button className="icon-button danger" title={t('Удалить')} disabled={busy} onClick={() => remove(current)}><Trash2 size={16} /></button></div>}
        {error && <p role="alert" className="runtime-error">{text(error)}</p>}{success && <p role="status">{success}</p>}
      </div></div>
  </dialog>;
}
