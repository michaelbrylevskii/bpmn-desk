import { FilePlus2, FolderOpen, Workflow, ArrowUpRight } from 'lucide-react';
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
    <div className="welcome-columns"><section><h3>{t("Примеры схем")}</h3><p className="muted">{t("Примеры BPMN, Flowable и Camunda 7")}</p>
      {examples.map(name => <button className="welcome-file" key={name} onClick={() => openExample(name)}><Workflow size={16} /><span>{name.replace('.bpmn20.xml', '')}</span><ArrowUpRight size={14} /></button>)}
    </section><section><h3>{t("Недавние файлы")}</h3>{recent.length ? recent.map(path => <button className="welcome-file" key={path} title={path} onClick={() => openRecent(path)}><FolderOpen size={16} /><span>{path.split(/[\\/]/).pop()}</span><ArrowUpRight size={14} /></button>) : <p className="muted">{t("Открытые файлы появятся здесь.")}<br />{t("Можно перетащить BPMN-файл в окно.")}</p>}</section></div>
    <div className="local-note">{t("Файлы открываются и сохраняются локально.")}</div>
  </div></main>;
}
