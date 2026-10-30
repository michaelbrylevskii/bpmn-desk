import type { DeadLetterJob } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
import { InstanceDetails } from './instance-details';
import { HistoryDetails } from './history-details';
import type { useSnapshot } from './use-snapshot';
import type { useHistory } from './use-history';

export function InstancePanel({ connection, snapshot, history, historyMode, setHistoryMode, xml, selected, focus, openInstance, jobSelection }: {
  connection: string; snapshot: ReturnType<typeof useSnapshot>; history: ReturnType<typeof useHistory>;
  historyMode: boolean; setHistoryMode: (value: boolean) => void; xml?: string; selected: string;
  focus: (id: string) => void; openInstance: (id: string) => void; jobSelection?: DeadLetterJob;
}) {
  const { t, text } = useI18n();
  const source = historyMode ? history : snapshot;
  return <section className="runtime-instance-panel" aria-label={t('Подробности экземпляра')}>
    <nav className="runtime-tabs instance-mode-tabs" aria-label={t('Подробности экземпляра')}>
      <button aria-pressed={!historyMode} onClick={() => setHistoryMode(false)}>{t('Текущее состояние')}</button>
      <button aria-pressed={historyMode} onClick={() => setHistoryMode(true)}>{t('История выполнения')}</button>
    </nav>
    {historyMode ? history.data && <HistoryDetails connection={connection} snapshot={history.data} xml={xml} selected={selected} focus={focus} openInstance={openInstance} /> :
      snapshot.data && <InstanceDetails connection={connection} snapshot={snapshot.data} selected={selected} focus={focus} openInstance={openInstance} jobSelection={jobSelection} />}
    {!source.data && <div className="runtime-source-status">
      {source.error ? <p className="runtime-error" role="alert">{text(source.error)}</p> : source.busy ? <p className="runtime-empty">{t('Загрузка состояния…')}</p> :
        !historyMode && snapshot.missing && <p className="runtime-empty">{t('Экземпляра нет в runtime. Он мог завершиться или быть удалён; подробности доступны в истории, если она сохранена.')}</p>}
    </div>}
  </section>;
}
