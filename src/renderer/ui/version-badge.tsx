import { useEffect, useState } from 'react';
import { version } from '../../../package.json';
import type { UpdatesBridge } from '../../shared/updates';
import { useI18n } from '../i18n/provider';
import { Tooltip } from './tooltip';

declare global { interface Window { updates?: UpdatesBridge } }

export function VersionBadge() {
  const { t } = useI18n(); const [available, setAvailable] = useState<string | null>(null);
  useEffect(() => {
    const bridge = window.updates; if (!bridge) return;
    let active = true; let changed = false;
    const unsubscribe = bridge.onChanged(status => { changed = true; setAvailable(status.availableVersion); });
    void bridge.status().then(status => { if (active && !changed) setAvailable(status.availableVersion); }).catch(() => undefined);
    return () => { active = false; unsubscribe(); };
  }, []);
  if (!available) return <span className="version">{version}</span>;
  const label = t('Доступна версия {version}. Открыть релиз на GitHub.', { version: available });
  return <span className="version-link"><Tooltip content={label}>
    <button className="version update-available" aria-label={label} onClick={() => { void window.updates?.openRelease().catch(() => undefined); }}>{version}</button>
  </Tooltip></span>;
}
