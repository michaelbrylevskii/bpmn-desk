import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n/provider';
import type { Notice } from '../notifications/types';
import { useNoticeDismiss } from './use-notice-dismiss';

const durations = { info: 6000, success: 5000, error: 12000 };

export function NotificationToast({ notice, close }: { notice: Notice; close: () => void }) {
  const { t, text } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fading = useNoticeDismiss(durations[notice.severity], hovered || focused || expanded, close);
  const Icon = notice.severity === 'error' ? CircleAlert : notice.severity === 'success' ? CircleCheck : Info;
  return <div className="toast" role={notice.severity === 'error' ? 'alert' : 'status'} data-severity={notice.severity} data-fading={fading}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }}>
    <Icon className="toast-icon" size={20} aria-hidden="true" />
    <div className="toast-content">
      {notice.title && <strong>{text(notice.title)}</strong>}
      <p>{text(notice.message)}</p>
      {notice.details && <details className="toast-details" onToggle={event => setExpanded(event.currentTarget.open)}><summary>{t('Технические подробности')}</summary><pre>{text(notice.details)}</pre></details>}
    </div>
    <button className="icon-button" title={t('Закрыть уведомление')} onClick={close}><X size={16} /></button>
  </div>;
}
