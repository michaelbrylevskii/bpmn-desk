import { useCallback, useEffect, useState } from 'react';
import { Settings2, Server } from 'lucide-react';
import type { Connections, DeployedDiagram } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { runtimeBridge } from '../platform/runtime';
import { useI18n } from '../i18n/provider';
import { ConnectionsDialog } from './connections-dialog';
import { RuntimeMonitor } from './monitor';

const selectionKey = 'bpmn-desk:runtime-connection';
export function RuntimeWorkspace({ active, copy }: { active: boolean; copy: (diagram: DeployedDiagram) => void }) {
  const { t, text } = useI18n(); const [connections, setConnections] = useState<Connections>({ items: [], secureStorage: false });
  const [connection, setConnection] = useState(''); const [managing, setManaging] = useState(false); const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const loadConnections = useCallback(async (id?: string) => {
    const profiles = await runtimeBridge().connections(); setConnections(profiles); setError(''); setRevision(value => value + 1);
    setConnection(current => {
      const next = id ?? current; return profiles.items.some(item => item.id === next) ? next : profiles.items[0]?.id ?? '';
    });
  }, []);
  useEffect(() => {
    const remembered = localStorage.getItem(selectionKey) ?? '';
    void loadConnections(remembered).catch(error => setError(errorMessage(error)));
  }, [loadConnections]);
  useEffect(() => { if (connection) localStorage.setItem(selectionKey, connection); else localStorage.removeItem(selectionKey); }, [connection]);
  const controls = <><Server size={18} /><select aria-label={t('Выбери подключение')} value={connection} onChange={event => setConnection(event.target.value)}>
    <option value="" disabled>{t('Выбери подключение')}</option>{connections.items.map(item => <option value={item.id} key={item.id}>{item.name} · Flowable</option>)}</select>
    <button className="icon-button" title={t('Управление подключениями')} disabled={!window.runtime} onClick={() => setManaging(true)}><Settings2 size={18} /></button><span className="runtime-readonly">{t('Только чтение')}</span></>;
  return <section className="runtime-workspace" aria-label={t('Состояние процессов')}>
    {error && <p role="alert" className="runtime-error">{text(error)}</p>}
    {connection ? <RuntimeMonitor key={`${connection}:${revision}`} connection={connection} controls={controls} active={active} copy={copy} /> : <>
      <header className="runtime-header">{controls}</header><div className="runtime-empty"><Server size={32} /><p>{t('Добавь подключение к REST API движка.')}</p>
        <button className="button primary" disabled={!window.runtime} onClick={() => setManaging(true)}>{t('Новое подключение')}</button></div></>}
    {managing && <ConnectionsDialog connections={connections} initialId={connection} close={() => setManaging(false)} changed={loadConnections} />}
  </section>;
}
