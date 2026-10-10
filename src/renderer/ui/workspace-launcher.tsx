import { FolderOpen, Server } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Connection } from '../../shared/runtime';
import type { DocumentProfile } from '../engines/contracts';
import { useI18n } from '../i18n/provider';
import { FileLibrary, type FileLibraryProps } from './file-library';
import { CreateDiagramMenu } from './create-diagram-menu';
import { Select } from './select';
export interface WorkspaceLauncherProps extends FileLibraryProps {
  create: (profile: DocumentProfile) => void; open: () => void; connections: Connection[]; savedId: string;
  monitor: (id: string) => void; manage: () => void; connectionError: string;
}
/** Единственный набор стартовых действий; Welcome добавляет шапку и восстановление. */
export function WorkspaceLauncher({ create, open, connections, savedId, monitor, manage, connectionError, ...library }: WorkspaceLauncherProps) {
  const { t, text } = useI18n(); const [connection, setConnection] = useState(savedId);
  useEffect(() => { setConnection(current => connections.some(item => item.id === savedId) ? savedId : connections.some(item => item.id === current) ? current : connections[0]?.id ?? ''); }, [connections, savedId]);
  return <div className="workspace-launcher">
    <div className="launcher-actions"><button className="button primary" aria-label={t('Открыть схему')} aria-keyshortcuts="Control+O" onClick={open}><FolderOpen size={18} />{t('Открыть схему')}<kbd aria-hidden="true">Ctrl O</kbd></button><CreateDiagramMenu create={create} /></div>
    <section className="launcher-monitor"><h3><Server size={18} />{t('Состояние процессов')}</h3>
      <Select label={t('Выбери подключение')} placeholder={t('Выбери подключение')} value={connection} onChange={setConnection} disabled={!window.runtime}
        options={[...connections.map(item => ({ value: item.id, label: item.name })), { value: '@new', label: t('Новое подключение'), action: manage }]} />
      <button className="button" disabled={!window.runtime || !connections.some(item => item.id === connection)} onClick={() => monitor(connection)}>{t('Открыть монитор')}</button>
      {connectionError && <p className="runtime-error" role="alert">{text(connectionError)}</p>}
    </section>
    <FileLibrary {...library} />
  </div>;
}
