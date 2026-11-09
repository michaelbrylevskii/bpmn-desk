import { X } from 'lucide-react';
import type { SessionOverview } from '../../shared/sessions';
import { useI18n } from '../i18n/provider';
export function SessionOffer({ session, restore, dismiss, compact = false, busy }: { session: SessionOverview; restore: () => void; dismiss: () => void; compact?: boolean; busy?: boolean }) {
  const { t } = useI18n();
  return <div className={compact ? 'pending-recovery' : 'recovery-banner'}><span>{t('Предыдущая сессия: {tabs} вкладок · {dirty} с изменениями', { tabs: session.tabs.length, dirty: session.tabs.filter(tab => tab.dirty).length })}</span><div><button className="button small" disabled={busy} onClick={restore}>{t('Восстановить')}</button><button className="icon-button" disabled={busy} aria-label={t('Скрыть предложение восстановления')} onClick={dismiss}><X size={15} /></button></div></div>;
}
