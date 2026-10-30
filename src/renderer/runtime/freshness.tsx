import { Info } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import { Tooltip } from '../ui/tooltip';

export function RuntimeFreshness({ runtime, history }: { runtime?: string; history?: string }) {
  const { t, language } = useI18n();
  if (!runtime && !history) return null;
  const items = [{ key: 'runtime', time: runtime, label: t('Состояние'), full: t('Текущее состояние') }, { key: 'history', time: history, label: t('История'), full: t('История выполнения') }].filter(item => item.time);
  return <div className="runtime-freshness"><Tooltip content={<>{items.map(item => <p key={item.key}><strong>{item.full}</strong>: {new Date(item.time!).toLocaleString(language)}</p>)}<p>{t('Снимок собирается несколькими запросами и может измениться во время чтения.')}</p></>}>
    <span className="runtime-snapshot-times" tabIndex={0}>{items.map(item => <time key={item.key} data-source={item.key} dateTime={item.time}>{item.label}: {new Date(item.time!).toLocaleTimeString(language, { hour12: false })}</time>)}<Info size={12} aria-hidden="true" /></span>
  </Tooltip></div>;
}
