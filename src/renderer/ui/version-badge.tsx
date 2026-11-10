import { useEffect, useState } from 'react';
import { version as installedVersion } from '../../../package.json';
import type { UpdatesBridge, UpdateStatus } from '../../shared/updates';
import { useI18n } from '../i18n/provider';
import { Tooltip } from './tooltip';

declare global { interface Window { updates?: UpdatesBridge } }

const versionOverride = import.meta.env.DEV ? import.meta.env.VITE_BPMN_DESK_DEV_VERSION : undefined;
const version = typeof versionOverride === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(versionOverride) ? versionOverride : installedVersion;

export function VersionBadge() {
  const { t } = useI18n(); const [status, setStatus] = useState<UpdateStatus>({ availableVersion: null, checking: false });
  useEffect(() => {
    const bridge = window.updates; if (!bridge) return;
    let active = true; let changed = false;
    const unsubscribe = bridge.onChanged(status => { changed = true; setStatus(status); });
    void bridge.status().then(status => { if (active && !changed) setStatus(status); }).catch(() => undefined);
    return () => { active = false; unsubscribe(); };
  }, []);
  const available = status.availableVersion;
  const label = status.checking ? t('Проверка обновлений…') : available ? t('Доступна версия {version}. Открыть релиз на GitHub.', { version: available }) : t('Проверить обновления');
  return <span className="version-link"><Tooltip content={label}>
    <button type="button" className={`version${available ? ' update-available' : ''}`} disabled={status.checking || !window.updates} aria-busy={status.checking} aria-label={label}
      onClick={() => { void (available ? window.updates?.openRelease() : window.updates?.check())?.catch(() => undefined); }}>{version}</button>
  </Tooltip></span>;
}
