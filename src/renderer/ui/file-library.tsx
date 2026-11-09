import { FolderOpen, X } from 'lucide-react';
import type { SessionOverview } from '../../shared/sessions';
import { useI18n } from '../i18n/provider';
import { Tooltip } from './tooltip';
import { SessionEntry } from './session-entry';
export interface FileLibraryProps {
  examples: string[]; recent: string[]; sessions: SessionOverview[];
  openExample: (name: string) => void; openRecent: (path: string) => void; removeRecent: (path: string) => void;
  restoreSession: (id: string) => void; removeSession: (id: string) => void;
  setSessionPin: (id: string, name: string | null) => Promise<void>;
}
export function FileLibrary({ recent, sessions, openRecent, removeRecent, restoreSession, removeSession, setSessionPin, connections }: FileLibraryProps & { connections: import('../../shared/runtime').Connection[] }) {
  const { t } = useI18n();
  return <div className="welcome-columns">
    <section aria-label={t('Сессии')}><h3>{t('Сессии')}</h3>
      {sessions.length ? sessions.map(session => <SessionEntry key={session.id} session={session} connections={connections} restore={() => restoreSession(session.id)} remove={() => removeSession(session.id)} setPin={name => setSessionPin(session.id, name)} />) : <p className="muted">{t('Сессии появятся здесь после открытия вкладок.')}</p>}
    </section>
    <section aria-label={t('Недавние файлы')}><h3>{t('Недавние файлы')}</h3>
      {recent.length ? recent.map(path => <div className="recent-entry" key={path}><Tooltip content={<span className="file-path">{path}</span>}><button className="welcome-file" onClick={() => openRecent(path)}><FolderOpen size={16} /><span>{path.split(/[\\/]/).pop()}</span></button></Tooltip><button className="recent-remove icon-button" aria-label={t('Удалить из недавних')} onClick={() => removeRecent(path)}><X size={13} /></button></div>) :
        <p className="muted">{t('Открытые файлы появятся здесь.')}<br />{t('Можно перетащить BPMN-файл в окно.')}</p>}
    </section>
  </div>;
}
