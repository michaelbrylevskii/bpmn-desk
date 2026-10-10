import { Workflow } from 'lucide-react';
import { WorkspaceLauncher, type WorkspaceLauncherProps } from './workspace-launcher';
import { useI18n } from '../i18n/provider';
export function Welcome({ recovery, restore, discardRecovery, ...launcher }: WorkspaceLauncherProps & {
  recovery: number; restore: () => void; discardRecovery: () => void;
}) {
  const { t } = useI18n();
  return <main className="welcome"><div className="welcome-inner">
    <div className="welcome-icon"><Workflow size={36} strokeWidth={1.5} /></div>
    <div className="eyebrow">{t('РЕДАКТОР И МОНИТОР BPMN')}</div>
    <h1>BPMN Desk</h1>
    <p className="welcome-description">{t("Открой BPMN-файл или создай новую схему.")}<br />{t("Свойства BPMN, Flowable и Camunda 7 доступны в редакторе.")}</p>
    {recovery > 0 && <div className="recovery-banner"><strong>{t('Есть несохранённые документы: {count}', { count: recovery })}</strong><div><button className="button small primary" onClick={restore}>{t("Восстановить")}</button><button className="button small ghost" onClick={discardRecovery}>{t("Отбросить")}</button></div></div>}
    <WorkspaceLauncher {...launcher} />
    <div className="local-note">{t("Файлы открываются и сохраняются локально.")}</div>
  </div></main>;
}
