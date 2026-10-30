import type { HistoryQuery } from '../../shared/history';
import { useI18n } from '../i18n/provider';

const dateInput = (value?: string) => {
  if (!value) return '';
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function HistoryFilters({ query, update }: { query: HistoryQuery; update: (key: 'startedAfter' | 'startedBefore' | 'finishedAfter' | 'finishedBefore', value: string | undefined) => void }) {
  const { t } = useI18n();
  return <>{([
    ['startedAfter', 'Начат после'], ['startedBefore', 'Начат до'], ['finishedAfter', 'Окончен после'], ['finishedBefore', 'Окончен до'],
  ] as const).map(([key, label]) => <label key={key}>{t(label)}<input type="datetime-local" value={dateInput(query[key])} onChange={event => update(key, event.target.value ? new Date(event.target.value).toISOString() : undefined)} /></label>)}</>;
}
