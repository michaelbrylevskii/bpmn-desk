import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ExternalLink, Workflow, X } from 'lucide-react';
import { version } from '../../../package.json';
import type { ApplicationBridge, ApplicationInfo, ApplicationLink } from '../../shared/application-info';
import { useI18n } from '../i18n/provider';

declare global { interface Window { application?: ApplicationBridge } }

export function AboutDialog({ close }: { close: () => void }) {
  const { t } = useI18n(); const dialog = useRef<HTMLDialogElement>(null);
  const [info, setInfo] = useState<ApplicationInfo | null>(null); const [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current; node?.showModal(); let active = true;
    void window.application?.info().then(value => { if (active) setInfo(value); }).catch(() => undefined);
    return () => { active = false; node?.close(); };
  }, []);
  const open = (event: MouseEvent<HTMLAnchorElement>, link: ApplicationLink) => {
    if (!window.application) return;
    event.preventDefault(); setError('');
    void window.application.openLink(link).catch(() => setError(t('Не удалось открыть ссылку.')));
  };
  const platform = info ? ({ linux: 'Linux', win32: 'Windows', darwin: 'macOS' }[info.platform] ?? info.platform) : '';
  return <dialog ref={dialog} className="about-dialog" aria-labelledby="about-title" onClose={close}>
    <div className="panel-heading"><h2 id="about-title">{t('О приложении')}</h2><button className="icon-button" title={t('Закрыть')} onClick={close}><X size={18} /></button></div>
    <div className="about-content">
      <div className="about-brand"><span className="brand-icon"><Workflow size={26} /></span><div><strong>BPMN Desk</strong><small>{t('Версия {version}', { version: info?.version ?? version })}</small></div></div>
      <p className="about-description">{t('Редактор BPMN и монитор процессов')}</p>
      <div className="about-author"><span>{t('Автор')}</span><a href="https://github.com/michaelbrylevskii" target="_blank" rel="noreferrer" onClick={event => open(event, 'author')}>Mikhail Brylevskii<ExternalLink size={12} /></a></div>
      <p className="about-credit">{t('Создано совместно с OpenAI Codex.')}</p>
      <a className="about-repository" href="https://github.com/michaelbrylevskii/bpmn-desk" target="_blank" rel="noreferrer" onClick={event => open(event, 'repository')}>{t('Проект на GitHub')}<ExternalLink size={13} /></a>
      <div className="about-technical"><h3>{t('Техническая информация')}</h3><dl>
        {info && <><dt>{t('Платформа')}</dt><dd>{platform} · {info.arch}</dd><dt>Electron</dt><dd>{info.electron}</dd><dt>Chromium</dt><dd>{info.chromium}</dd><dt>Node.js</dt><dd>{info.node}</dd></>}
        <dt>{t('Лицензия')}</dt><dd>MIT</dd>
      </dl></div>
      {error && <p role="alert" className="about-error">{error}</p>}
    </div>
  </dialog>;
}
