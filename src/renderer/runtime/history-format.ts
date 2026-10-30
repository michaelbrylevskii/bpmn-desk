import type { Language } from '../../shared/i18n';

export function historyTime(value: string, language: Language): string {
  return value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-GB', { fractionalSecondDigits: 3, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
}
export function historyDuration(value: number | null, language: Language): string {
  if (value === null) return '—';
  const units = language === 'ru' ? ['мс', 'с', 'мин', 'ч', 'д'] : ['ms', 's', 'min', 'h', 'd'];
  if (value < 1000) return `${value} ${units[0]}`;
  if (value < 60000) return `${Number((value / 1000).toFixed(2))} ${units[1]}`;
  const minutes = Math.floor(value / 60000);
  if (minutes < 60) return `${minutes} ${units[2]} ${Math.floor(value / 1000) % 60} ${units[1]}`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} ${units[3]} ${minutes % 60} ${units[2]}` : `${Math.floor(hours / 24)} ${units[4]} ${hours % 24} ${units[3]}`;
}
