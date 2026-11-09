import { Check, History, Pencil, Pin, PinOff, Server, Workflow, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SessionOverview } from '../../shared/sessions';
import type { Connection } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { useI18n } from '../i18n/provider';
import { Tooltip } from './tooltip';

export function SessionEntry({ session, connections, restore, remove, setPin }: {
  session: SessionOverview; connections: Connection[]; restore: () => void; remove: () => void;
  setPin: (name: string | null) => Promise<void>;
}) {
  const { t, text, language } = useI18n();
  const [editing, setEditing] = useState(false); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const date = new Date(session.updatedAt).toLocaleString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const dirty = session.tabs.filter(tab => tab.dirty).length;
  const begin = () => { setName(session.name || t('Сессия {date}', { date })); setError(''); setEditing(true); };
  const update = async (value: string | null) => {
    setBusy(true); setError('');
    try { await setPin(value); setEditing(false); } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  return <div className="session-entry" data-pinned={!!session.pinned}>
    <div className="recent-entry">
      {editing ? <form className="session-name-form" onSubmit={event => { event.preventDefault(); void update(name); }}>
        <input ref={input} aria-label={t('Имя сессии')} value={name} required maxLength={80} disabled={busy} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' && !busy) { event.stopPropagation(); setEditing(false); setError(''); } }} />
        <button className="icon-button" aria-label={t('Сохранить имя и закрепить')} disabled={busy || !name.trim()}><Check size={15} /></button>
        <button type="button" className="icon-button" aria-label={t('Отменить ввод имени')} disabled={busy} onClick={() => { setEditing(false); setError(''); }}><X size={14} /></button>
      </form> : <>
        <Tooltip content={<div className="session-tooltip">{session.name && <strong>{session.name}</strong>}<strong>{new Date(session.updatedAt).toLocaleString(language)}</strong>
          {session.open && <div>{t('Сессия уже открыта в другом окне.')}</div>}
          {session.tabs.map((tab, index) => {
            const connection = connections.find(connection => connection.id === tab.connectionId);
            const engine = connection?.engine === 'camunda7' ? 'Camunda 7' : 'Flowable';
            const label = tab.kind === 'monitor' ? `${connection ? t('{engine} монитор', { engine }) : t('Монитор')} · ${connection?.name || t('Подключение недоступно')}` : tab.name;
            return <div className="session-tooltip-row" key={index}>{tab.kind === 'monitor' ? <Server size={14} /> : <Workflow size={14} />}<div><span>{label}</span>{tab.context && !/^[\da-f-]{32,}$/i.test(tab.context) && <small>{tab.context}</small>}{tab.dirty && <strong className="session-unsaved">{t('Несохранённые изменения')}</strong>}</div></div>;
          })}</div>}>
          <button className="welcome-file" onClick={restore}>{session.pinned ? <Pin size={16} /> : <History size={16} />}<span>{session.name || date}</span><small className={dirty ? 'session-dirty' : ''}>{t('{tabs} вкладок · {dirty} с изменениями', { tabs: session.tabs.length, dirty })}</small></button>
        </Tooltip>
        {session.pinned && <button className="recent-remove icon-button" aria-label={t('Переименовать сессию')} title={t('Переименовать сессию')} onClick={begin}><Pencil size={13} /></button>}
        <button className="recent-remove icon-button" disabled={busy} aria-label={t(session.pinned ? 'Открепить сессию' : 'Закрепить сессию')} title={t(session.pinned ? 'Открепить сессию' : 'Закрепить сессию')} onClick={() => session.pinned ? void update(null) : begin()}>{session.pinned ? <PinOff size={13} /> : <Pin size={13} />}</button>
        <button className="recent-remove icon-button" aria-label={t('Удалить сессию')} disabled={session.open || busy} title={session.open ? t('Сессия уже открыта в другом окне.') : t('Удалить сессию')} onClick={remove}><X size={13} /></button>
      </>}
    </div>{error && <p role="alert" className="session-name-error">{text(error)}</p>}
  </div>;
}
