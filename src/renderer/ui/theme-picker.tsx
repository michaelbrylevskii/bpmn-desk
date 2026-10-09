import { Monitor, Moon, Sun } from 'lucide-react';
import { useI18n } from '../i18n/provider';
import type { ThemeMode } from './use-theme';

/** Три явно выбранных режима; подсветка показывает настройку, а не вычисленную тему. */
export function ThemePicker({ mode, change }: { mode: ThemeMode; change: (mode: ThemeMode) => void }) {
  const { t } = useI18n();
  const choices = [
    { mode: 'auto', title: t('Системная тема'), Icon: Monitor },
    { mode: 'light', title: t('Светлая тема'), Icon: Sun },
    { mode: 'dark', title: t('Тёмная тема'), Icon: Moon },
  ] as const;
  return <div className="theme-picker" role="group" aria-label={t('Тема интерфейса')}>
    {choices.map(({ mode: value, title, Icon }) => <button key={value} className="icon-button" title={title} aria-label={title} aria-pressed={mode === value} onClick={() => change(value)}><Icon size={16} /></button>)}
  </div>;
}
