import { Check, Clock3 } from 'lucide-react';
import type { Instance } from '../../shared/runtime';
import { RelatedInstance } from './relationships';
import type { HistoricActivity } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { historyDuration, historyTime } from './history-format';

export function HistoryActivity({ activity, child, index, count, complete, selected, choose, openInstance }: {
  child?: Instance; activity: HistoricActivity; index: number; count: number; complete: boolean; selected: boolean;
  choose: () => void; openInstance: (id: string, preview?: Instance) => void;
}) {
  const { t, language } = useI18n();
  return <article className={`history-activity ${selected ? 'selected' : ''}`} data-history-id={activity.id} data-element-id={activity.activityId}>
    <button className="history-activity-choice" aria-expanded={selected} onClick={choose}>
      <span className={`history-step-icon ${activity.endTime ? 'ended' : 'unfinished'}`} title={t(activity.endTime ? 'Окончание зафиксировано' : 'Окончание не зафиксировано')}>
        {activity.endTime ? <Check size={15} /> : <Clock3 size={15} />}
      </span><span><strong>{activity.activityName || activity.activityId || activity.id}</strong>
        <small><time dateTime={activity.startTime || undefined}>{historyTime(activity.startTime, language)}</time></small>
        <small>{activity.activityType} · {historyDuration(activity.durationInMillis, language)}{count > 1 && ` · ${t('Проход {index} из {count}', { index, count: `${complete ? '' : '≥'}${count}` })}`}</small>
      </span>
    </button>
    {selected && <div className="history-activity-details"><dl>
      <dt>{t('Состояние')}</dt><dd>{t(activity.endTime ? 'Окончание зафиксировано' : 'Окончание не зафиксировано')}</dd>
      <dt>{t('Начат')}</dt><dd>{historyTime(activity.startTime, language)}</dd>
      <dt>{t('Окончен')}</dt><dd>{historyTime(activity.endTime, language)}</dd>
      <dt>{t('Длительность')}</dt><dd>{historyDuration(activity.durationInMillis, language)}</dd>
      <dt>{t('Исполнитель')}</dt><dd>{activity.assignee || '—'}</dd>
      <dt>{t('ID элемента')}</dt><dd><code>{activity.activityId || '—'}</code></dd>
      <dt>{t('ID выполнения шага')}</dt><dd><code>{activity.id}</code></dd>
      <dt>{t('ID execution')}</dt><dd><code>{activity.executionId || '—'}</code></dd>
      {activity.taskId && <><dt>{t('ID задачи')}</dt><dd><code>{activity.taskId}</code></dd></>}
    </dl>{activity.calledProcessInstanceId && <RelatedInstance role="child" id={activity.calledProcessInstanceId} instance={child} open={openInstance} />}</div>}
  </article>;
}
