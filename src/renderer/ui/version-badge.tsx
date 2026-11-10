import { useEffect, useState } from 'react';
import { version as installedVersion } from '../../../package.json';
import type { UpdatesBridge, UpdateStatus } from '../../shared/updates';
import { useI18n } from '../i18n/provider';
import { Tooltip } from './tooltip';

declare global { interface Window { updates?: UpdatesBridge } }

const versionOverride = import.meta.env.DEV ? import.meta.env.VITE_BPMN_DESK_DEV_VERSION : undefined;
const version = typeof versionOverride === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(versionOverride) ? versionOverride : installedVersion;

export function VersionBadge() {
  const { t, language } = useI18n(); const [status, setStatus] = useState<UpdateStatus>({ availableVersion: null, checking: false, lastCheck: null });
  useEffect(() => {
    const bridge = window.updates; if (!bridge) return;
    let active = true; let changed = false;
    const unsubscribe = bridge.onChanged(status => { changed = true; setStatus(status); });
    void bridge.status().then(status => { if (active && !changed) setStatus(status); }).catch(() => undefined);
    return () => { active = false; unsubscribe(); };
  }, []);
  const available = status.availableVersion;
  const label = status.checking ? t('Проверка обновлений…') : available ? t('Доступна версия {version}. Открыть релиз на GitHub.', { version: available }) : t('Проверить обновления');
  const result = status.lastCheck?.result;
  const summary = status.checking ? t('Проверка обновлений…') : result === 'timeout' ? t('Время ожидания проверки истекло.') : result === 'error' ? t('Не удалось проверить обновления.')
    : available ? t('Доступна версия {version}.', { version: available }) : result === 'success' ? t('Новых версий не обнаружено.') : t('Обновления приложения');
  const content = <div className="version-tooltip"><strong>{summary}</strong>
    {status.lastCheck && <p className="version-check-time"><span>{t('Последняя проверка')}</span><time dateTime={status.lastCheck.completedAt}>{new Date(status.lastCheck.completedAt).toLocaleString(language, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</time></p>}
    {!status.checking && <p className="version-check-action">{available ? t('Нажмите, чтобы открыть релиз на GitHub.') : status.lastCheck ? t('Нажмите для повторной проверки.') : t('Нажмите для проверки.')}</p>}
  </div>;
  return <span className="version-link"><Tooltip content={content}>
    <button type="button" className={`version${available ? ' update-available' : ''}`} disabled={status.checking || !window.updates} aria-busy={status.checking} aria-label={label}
      onClick={() => { void (available ? window.updates?.openRelease() : window.updates?.check())?.catch(() => undefined); }}>{version}</button>
  </Tooltip></span>;
}
