import { FolderOpen, Server, Plus } from 'lucide-react';
import type { Connection } from '../../shared/runtime';
import type { DocumentProfile } from '../engines/contracts';
import { useI18n } from '../i18n/provider';
import { FileLibrary, type FileLibraryProps } from './file-library';
import { CreateDiagramMenu } from './create-diagram-menu';
import { MenuButton } from './command-menu';
export interface WorkspaceLauncherProps extends FileLibraryProps {
  create: (profile: DocumentProfile) => void; open: () => void; connections: Connection[]; savedId: string;
  monitor: (id: string) => void; manage: () => void; connectionError: string;
}
export function WorkspaceLauncher({ create, open, connections, monitor, manage, connectionError, ...library }: WorkspaceLauncherProps) {
  const { t, text } = useI18n();
  return <div className="workspace-launcher">
    <div className="launcher-actions"><button className="button primary" aria-label={t('Открыть схему')} aria-keyshortcuts="Control+O" onClick={open}><FolderOpen size={18} />{t('Открыть схему')}<kbd aria-hidden="true">Ctrl O</kbd></button><CreateDiagramMenu create={create} examples={library.examples} openExample={library.openExample} />
      <MenuButton label={t('Открыть монитор')} icon={<Server size={18} />} disabled={!window.runtime} items={[
        ...connections.map(connection => ({ label: connection.name, action: () => monitor(connection.id), icon: <Server size={16} /> })),
        ...connections.length ? [{ label: '', separator: true }] : [],
        { label: t('Новое подключение'), action: manage, icon: <Plus size={16} /> },
      ]} /></div>
    {connectionError && <p className="runtime-error" role="alert">{text(connectionError)}</p>}
    <FileLibrary {...library} connections={connections} />
    {!library.sessions.length && !library.recent.length && !!library.examples.length && <MenuButton label={t('Примеры схем')} className="examples-link" items={library.examples.map(name => ({ label: name.replace('.bpmn20.xml', ''), action: () => library.openExample(name) }))} />}
  </div>;
}
