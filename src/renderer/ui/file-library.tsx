import { ArrowUpRight, FolderOpen, Workflow } from 'lucide-react';
import { useI18n } from '../i18n/provider';

export interface FileLibraryProps {
  examples: string[]; recent: string[]; openExample: (name: string) => void; openRecent: (path: string) => void;
}

/** Общие списки стартовой страницы и выбора новой вкладки; открывает файлы через callbacks. */
export function FileLibrary({ examples, recent, openExample, openRecent }: FileLibraryProps) {
  const { t } = useI18n();
  return <div className="welcome-columns">
    <section aria-label={t('Примеры схем')}><h3>{t('Примеры схем')}</h3><p className="muted">{t('Примеры BPMN, Flowable и Camunda 7')}</p>
      {examples.map(name => <button className="welcome-file" key={name} title={name} onClick={() => openExample(name)}><Workflow size={16} /><span>{name.replace('.bpmn20.xml', '')}</span><ArrowUpRight size={14} /></button>)}
    </section>
    <section aria-label={t('Недавние файлы')}><h3>{t('Недавние файлы')}</h3>
      {recent.length ? recent.map(path => <button className="welcome-file" key={path} title={path} onClick={() => openRecent(path)}><FolderOpen size={16} /><span>{path.split(/[\\/]/).pop()}</span><ArrowUpRight size={14} /></button>) :
        <p className="muted">{t('Открытые файлы появятся здесь.')}<br />{t('Можно перетащить BPMN-файл в окно.')}</p>}
    </section>
  </div>;
}
