import { Workflow } from 'lucide-react';
import { WorkspaceLauncher, type WorkspaceLauncherProps } from './workspace-launcher';
import { useI18n } from '../i18n/provider';
export function Welcome({ offer, ...launcher }: WorkspaceLauncherProps & { offer?: import('react').ReactNode }) {
  const { t } = useI18n();
  return <main className="welcome"><div className="welcome-inner">
    <div className="welcome-icon"><Workflow size={36} strokeWidth={1.5} /></div>
    <div className="eyebrow">{t('РЕДАКТОР И МОНИТОР BPMN')}</div>
    <h1>BPMN Desk</h1>
    <p className="welcome-description">{t("Открой BPMN-файл или создай новую схему.")}<br />{t("Свойства BPMN, Flowable и Camunda 7 доступны в редакторе.")}</p>
    {offer}
    <WorkspaceLauncher {...launcher} />
    <div className="local-note">{t("Файлы открываются и сохраняются локально.")}</div>
  </div></main>;
}
