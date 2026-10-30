import type { Instance } from '../../shared/runtime';
import type { HistoricInstance } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { historyDuration, historyTime } from './history-format';

/** Общий порядок и формат полей; статус интерпретируется в рамках своего источника. */
export function InstanceFields({ process, definition }: { process: Instance | HistoricInstance; definition: (id: string) => void }) {
  const { t, language } = useI18n(); const history = 'endTime' in process ? process : undefined;
  const state = history ? history.deleteReason ? 'Прекращён' : history.endTime ? 'Завершён' : 'Не окончен по данным истории' : process.suspended ? 'Приостановлен' : 'Активен';
  return <dl className="instance-fields"><dt>{t('Движок')}</dt><dd>Flowable</dd>
    <dt>{t('Состояние')}</dt><dd>{t(state)}</dd>
    <dt>{t('Начат')}</dt><dd>{historyTime(process.startTime, language)}</dd>
    {history?.endTime && <><dt>{t('Окончен')}</dt><dd>{historyTime(history.endTime, language)}</dd></>}
    {history?.durationInMillis !== undefined && history.durationInMillis !== null && <><dt>{t('Длительность')}</dt><dd>{historyDuration(history.durationInMillis, language)}</dd></>}
    <dt>{t('ID определения')}</dt><dd><button className="runtime-link instance-definition-link" onClick={() => definition(process.processDefinitionId)}><code>{process.processDefinitionId}</code></button></dd>
    <dt>{t('Tenant ID')}</dt><dd>{process.tenantId || '—'}</dd>
    {history?.startUserId && <><dt>{t('Инициатор')}</dt><dd>{history.startUserId}</dd></>}
    {history?.deleteReason && <><dt>{t('Причина прекращения')}</dt><dd>{history.deleteReason}</dd></>}
  </dl>;
}
