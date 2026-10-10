import { FilePlus2, FolderOpen, Workflow } from 'lucide-react';
import { FileLibrary } from './file-library';
import { useI18n } from '../i18n/provider';
export function Welcome({ create, open, examples, recent, openExample, openRecent, recovery, restore, discardRecovery }: {
  create: () => void; open: () => void; examples: string[]; recent: string[];
  openExample: (name: string) => void; openRecent: (path: string) => void;
  recovery: number; restore: () => void; discardRecovery: () => void;
}) {
  const { t } = useI18n();
  return <main className="welcome"><div className="welcome-inner">
    <div className="welcome-icon"><Workflow size={36} strokeWidth={1.5} /></div>
    <div className="eyebrow">{t("ЛОКАЛЬНЫЙ РЕДАКТОР BPMN")}</div>
    <h1>BPMN Desk</h1>
    <p className="welcome-description">{t("Открой BPMN-файл или создай новую схему.")}<br />{t("Свойства BPMN, Flowable и Camunda 7 доступны в редакторе.")}</p>
    <div className="welcome-actions"><button className="button primary" onClick={open}><FolderOpen size={18} />{t("Открыть схему")}<kbd>Ctrl O</kbd></button><button className="button" onClick={create}><FilePlus2 size={18} />{t("Новая вкладка")}</button></div>
    {recovery > 0 && <div className="recovery-banner"><strong>{t('Есть несохранённые документы: {count}', { count: recovery })}</strong><div><button className="button small primary" onClick={restore}>{t("Восстановить")}</button><button className="button small ghost" onClick={discardRecovery}>{t("Отбросить")}</button></div></div>}
    <FileLibrary examples={examples} recent={recent} openExample={openExample} openRecent={openRecent} />
    <div className="local-note">{t("Файлы открываются и сохраняются локально.")}</div>
  </div></main>;
}
