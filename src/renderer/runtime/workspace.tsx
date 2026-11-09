import { useEffect, useState } from 'react';
import type { SessionMonitor } from '../../shared/sessions';
import { requestTimeoutSeconds } from '../../shared/runtime';
import type { Connections, DeployedDiagram } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
import type { MonitorControls } from './controls';
import { RuntimeMonitor } from './monitor';
export function RuntimeWorkspace({ initial, summaryEnabled, setSummaryEnabled, dark, id, connectionId, connections, revision, active, copy, publish }: { initial?: SessionMonitor; summaryEnabled: boolean; setSummaryEnabled: (value: boolean) => void; dark: boolean; id: string; connectionId: string; connections: Connections; revision: number;
  active: boolean; copy: (diagram: DeployedDiagram) => void; publish: (id: string, controls: MonitorControls | undefined) => void }) {
  const [started, setStarted] = useState(active);
  useEffect(() => { if (active) setStarted(true); }, [active]);
  const { t } = useI18n(); const profile = connections.items.find(item => item.id === connectionId);
  return <section className="runtime-workspace" aria-label={t('Состояние процессов')}>
    {started && (profile ? <RuntimeMonitor initial={initial} summaryEnabled={summaryEnabled} setSummaryEnabled={setSummaryEnabled} requestTimeout={profile.requestTimeoutSeconds ?? requestTimeoutSeconds.default} dark={dark} key={JSON.stringify([profile.id, profile.baseUrl, profile.authentication, profile.username])} id={id} connection={profile.id} revision={revision} active={active} copy={copy} publish={publish} /> :
      <p className="runtime-empty">{t('Подключение удалено. Выбери другое подключение.')}</p>)}
  </section>;
}
