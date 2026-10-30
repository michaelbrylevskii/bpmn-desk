import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '../i18n/provider';

/** Панель не раскрывается из-за выбора элемента. Язычок сообщает о новых подробностях. */
export function MonitorPanel({ side, hidden, toggle, changed = '', children }: {
  side: 'left' | 'right'; hidden: boolean; toggle: () => void; changed?: string; children: ReactNode;
}) {
  const { t } = useI18n(); const id = useId(); const previous = useRef('');
  const [pulse, setPulse] = useState(false); const [unread, setUnread] = useState(false);
  useEffect(() => {
    const updated = previous.current !== changed; previous.current = changed;
    if (!hidden) { setPulse(false); setUnread(false); }
    else if (side === 'right' && updated) { setPulse(true); setUnread(true); }
  }, [changed, hidden, side]);
  const label = side === 'left' ? hidden ? 'Показать каталог' : 'Скрыть каталог' : hidden ? 'Показать подробности' : 'Скрыть подробности';
  const pointsLeft = side === 'left' ? !hidden : hidden;
  return <div className={`runtime-panel runtime-panel-${side}${hidden ? ' collapsed' : ''}`}>
    <button className={`runtime-panel-toggle${pulse ? ' updated' : ''}`} title={t(label)} aria-label={t(label)} aria-expanded={!hidden} aria-controls={id}
      aria-describedby={unread ? `${id}-notice` : undefined} data-updated={unread || undefined} onClick={toggle} onAnimationEnd={() => setPulse(false)}>
      {pointsLeft ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
    </button>
    <div id={id} className={`runtime-panel-content ${side === 'left' ? 'runtime-catalog-host' : 'runtime-details-host'}`} hidden={hidden}>{children}</div>
    {unread && <span id={`${id}-notice`} className="sr-only">{t('Выбран другой элемент. Данные панели обновлены.')}</span>}
  </div>;
}
