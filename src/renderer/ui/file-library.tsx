import { FolderOpen, History, X } from 'lucide-react';
import type { SessionOverview } from '../../shared/sessions';
import { useI18n } from '../i18n/provider';
import { Tooltip } from './tooltip';
export interface FileLibraryProps {
  examples: string[]; recent: string[]; sessions: SessionOverview[];
  openExample: (name: string) => void; openRecent: (path: string) => void; removeRecent: (path: string) => void;
  restoreSession: (id: string) => void; removeSession: (id: string) => void;
}
export function FileLibrary({ recent, sessions, openRecent, removeRecent, restoreSession, removeSession, connections }: FileLibraryProps & { connections: import('../../shared/runtime').Connection[] }) {
  const { t, language } = useI18n();
  return <div className="welcome-columns">
    <section aria-label={t('Недавние сессии')}><h3>{t('Недавние сессии')}</h3>
      {sessions.length ? sessions.map(session => {
        const dirty = session.tabs.filter(tab => tab.dirty).length; const date = new Date(session.updatedAt).toLocaleString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        return <div className="recent-entry" key={session.id}>
          <Tooltip content={<div className="session-tooltip"><strong>{new Date(session.updatedAt).toLocaleString(language)}</strong>{session.open && <div>{t('Сессия уже открыта в другом окне.')}</div>}{session.tabs.map((tab, index) => <div key={index}>{tab.name}{tab.connectionId && <span> · {connections.find(connection => connection.id === tab.connectionId)?.name || tab.connectionId}</span>}{tab.dirty && <span> · {t('Несохранённые изменения')}</span>}</div>)}</div>}>
            <button className="welcome-file" onClick={() => restoreSession(session.id)}><History size={16} /><span>{date}</span><small className={dirty ? 'session-dirty' : ''}>{t('{tabs} вкладок · {dirty} с изменениями', { tabs: session.tabs.length, dirty })}</small></button>
          </Tooltip><button className="recent-remove icon-button" aria-label={t('Удалить сессию')} disabled={session.open} title={session.open ? t('Сессия уже открыта в другом окне.') : undefined} onClick={() => removeSession(session.id)}><X size={13} /></button>
        </div>;
      }) : <p className="muted">{t('Сессии появятся здесь после открытия вкладок.')}</p>}
    </section>
    <section aria-label={t('Недавние файлы')}><h3>{t('Недавние файлы')}</h3>
      {recent.length ? recent.map(path => <div className="recent-entry" key={path}><Tooltip content={<span className="file-path">{path}</span>}><button className="welcome-file" onClick={() => openRecent(path)}><FolderOpen size={16} /><span>{path.split(/[\\/]/).pop()}</span></button></Tooltip><button className="recent-remove icon-button" aria-label={t('Удалить из недавних')} onClick={() => removeRecent(path)}><X size={13} /></button></div>) :
        <p className="muted">{t('Открытые файлы появятся здесь.')}<br />{t('Можно перетащить BPMN-файл в окно.')}</p>}
    </section>
  </div>;
}
