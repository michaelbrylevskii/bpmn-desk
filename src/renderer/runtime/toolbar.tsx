import { CopyPlus, RefreshCw } from 'lucide-react';
import type { Connection } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
import { Select } from '../ui/select';
import type { MonitorControls } from './controls';
export function RuntimeToolbar({ connectionId, connections, controls, choose, manage }: { connectionId: string; connections: Connection[];
  controls?: MonitorControls; choose: (id: string) => void; manage: (id: string) => void }) {
  const { t } = useI18n();
  return <div className="runtime-toolbar-tools"><Select className="connection-picker" label={t('Выбери подключение')} value={connectionId} placeholder={t('Выбери подключение')} onChange={choose}
    options={[...connections.map(item => ({ value: item.id, label: item.name })), { value: '@new', label: t('Новое подключение'), action: () => manage('') }]} />
    <button className="icon-button" title={t('Обновить состояние')} disabled={!controls?.canRefresh || controls.busy} onClick={controls?.refresh}><RefreshCw className={controls?.busy ? 'spinning' : ''} size={18} /></button>
    <label className="runtime-check auto-refresh"><input type="checkbox" aria-label={t('Автообновление каждые 5 секунд')} checked={controls?.auto ?? false} disabled={!controls?.canRefresh} onChange={event => controls?.setAuto(event.target.checked)} />{t('Автообновление')}</label>
    <button className="button ghost" title={t('Создать локальную копию')} disabled={!controls?.canCopy} onClick={controls?.copy}><CopyPlus size={17} />{t('Создать локальную копию')}</button>
  </div>;
}
