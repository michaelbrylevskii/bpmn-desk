import { Workflow, X, Server } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DocumentProfile } from '../engines/contracts';
import type { Connection } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
import { FileLibrary, type FileLibraryProps } from './file-library';
import { Select } from './select';

export function NewDiagramDialog({ create, close, connections, savedId, monitor, manage, examples, recent, openExample, openRecent }: { create: (profile: DocumentProfile) => void; close: () => void;
  connections: Connection[]; savedId: string; monitor: (id: string) => void; manage: () => void } & FileLibraryProps) {
  const { t } = useI18n(); const dialog = useRef<HTMLDialogElement>(null); const [connection, setConnection] = useState(savedId || connections[0]?.id || '');
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => {
    setConnection(current => connections.some(item => item.id === savedId) ? savedId :
      connections.some(item => item.id === current) ? current : connections[0]?.id ?? '');
  }, [savedId, connections]);
  return <dialog ref={dialog} className="new-diagram-dialog" aria-labelledby="new-diagram-title" onClose={close}>
    <div className="panel-heading"><h2 id="new-diagram-title">{t('Новая вкладка')}</h2><button className="icon-button" title={t('Закрыть')} onClick={close}><X size={16} /></button></div>
    <div className="new-tab-content"><p>{t('Локальная схема')}</p><div className="diagram-profile-choices">
      {([{ id: 'bpmn', title: 'BPMN 2.0' }, { id: 'flowable', title: 'Flowable' }, { id: 'camunda7', title: 'Camunda 7' }] as const).map(profile =>
        <button key={profile.id} className="diagram-profile-choice" data-profile={profile.id} onClick={() => create(profile.id)}><Workflow size={20} /><span>{profile.title}</span></button>)}
    </div>
    <section className="new-monitor-choice"><h3><Server size={18} />{t('Состояние процессов')}</h3>
      <Select label={t('Выбери подключение')} value={connection} placeholder={t('Выбери подключение')} onChange={setConnection} disabled={!window.runtime}
        options={[...connections.map(item => ({ value: item.id, label: item.name })), { value: '@new', label: t('Новое подключение'), action: manage }]} />
      <button className="button primary" disabled={!window.runtime || !connections.some(item => item.id === connection)} onClick={() => monitor(connection)}>{t('Открыть монитор')}</button>
    </section>
    <div className="new-tab-library"><FileLibrary examples={examples} recent={recent} openExample={openExample} openRecent={openRecent} /></div>
    </div>
  </dialog>;
}
