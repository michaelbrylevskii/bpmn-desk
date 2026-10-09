import { Workflow, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { DocumentProfile } from '../engines/contracts';
import { useI18n } from '../i18n/provider';

/** Один выбор профиля для toolbar, welcome, новой вкладки и native shortcut. */
export function NewDiagramDialog({ create, close }: { create: (profile: DocumentProfile) => void; close: () => void }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  return <dialog ref={dialog} className="new-diagram-dialog" aria-labelledby="new-diagram-title" onClose={close}>
    <div className="panel-heading"><h2 id="new-diagram-title">{t('Новая схема')}</h2><button className="icon-button" title={t('Закрыть')} onClick={close}><X size={16} /></button></div>
    <p>{t('Выбери профиль схемы.')}</p><div className="diagram-profile-choices">
      {([{ id: 'bpmn', title: 'BPMN 2.0' }, { id: 'flowable', title: 'Flowable' }, { id: 'camunda7', title: 'Camunda 7' }] as const).map(profile =>
        <button key={profile.id} className="diagram-profile-choice" data-profile={profile.id} onClick={() => create(profile.id)}><Workflow size={20} /><span>{profile.title}</span></button>)}
    </div>
  </dialog>;
}
