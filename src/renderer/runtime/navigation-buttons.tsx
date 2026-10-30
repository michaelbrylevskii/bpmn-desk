import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import { Tooltip } from '../ui/tooltip';
import type { MonitorControls } from './controls';

export function NavigationButtons({ navigation }: { navigation?: MonitorControls['navigation'] }) {
  const { t } = useI18n();
  return <nav className="monitor-navigation" aria-label={t('Переходы монитора')}>{(['back', 'forward'] as const).map(direction => {
    const target = navigation?.[direction]; const label = t(direction === 'back' ? 'Назад' : 'Вперёд');
    return <Tooltip key={direction} content={target ? <div className="navigation-destination"><small>{label} · {t(target.kind === 'instance' ? 'Экземпляр' : target.kind === 'job' ? 'Dead-letter jobs' : 'Версия схемы')}</small>
      <strong>{target.name || t('Название схемы недоступно')}{target.version !== undefined && ` · v${target.version}`}</strong>
      {target.businessKey && <span>{target.businessKey}</span>}<code>{target.id}</code>
    </div> : t(direction === 'back' ? 'Нет предыдущих переходов' : 'Нет следующих переходов')}>
      <button className="icon-button" aria-label={label} disabled={!target} onClick={() => navigation?.move(direction)}>{direction === 'back' ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}</button>
    </Tooltip>;
  })}</nav>;
}
