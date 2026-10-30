import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { HistorySnapshot } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { Variables } from './variables';
import { HistoryList } from './history-list';
import { historyDuration, historyTime } from './history-format';

export function HistoryDetails({ snapshot, xml, selected, focus, openInstance }: {
  snapshot: HistorySnapshot; xml?: string; selected: string; focus: (id: string) => void; openInstance: (id: string) => void;
}) {
  const { t, text, language } = useI18n(); const [tab, setTab] = useState<'history' | 'variables'>('history');
  const process = snapshot.instance;
  return <aside className="runtime-details history-details" aria-label={t('История выполнения')}>
    <div className="runtime-instance"><strong>{process.businessKey || process.name || process.id}</strong><code>{process.id}</code>
      <dl><dt>{t('Состояние')}</dt><dd>{t(process.deleteReason ? 'Прекращён' : process.endTime ? 'Завершён' : 'Не окончен по данным истории')}</dd>
        <dt>{t('Начат')}</dt><dd>{historyTime(process.startTime, language)}</dd>
        <dt>{t('Окончен')}</dt><dd>{historyTime(process.endTime, language)}</dd>
        <dt>{t('Длительность')}</dt><dd>{historyDuration(process.durationInMillis, language)}</dd>
        {process.startUserId && <><dt>{t('Инициатор')}</dt><dd>{process.startUserId}</dd></>}
        {process.deleteReason && <><dt>{t('Причина прекращения')}</dt><dd>{process.deleteReason}</dd></>}
      </dl>
      <details className="history-metadata"><summary>{t('Подробности экземпляра')}</summary><dl><dt>{t('ID определения')}</dt><dd><code>{process.processDefinitionId}</code></dd><dt>{t('Tenant ID')}</dt><dd>{process.tenantId || '—'}</dd></dl></details>
      {(process.superProcessInstanceId || snapshot.children.data.length > 0 || !snapshot.children.complete) && <details className="instance-relationships"><summary>{t('Связанные экземпляры')}</summary>
        {process.superProcessInstanceId && <button className="related-instance" onClick={() => openInstance(process.superProcessInstanceId)}><ArrowRight size={14} /><span>{t('Родительский экземпляр')}: <code>{process.superProcessInstanceId}</code></span></button>}
        {snapshot.children.data.map(child => <button key={child.id} className="related-instance" onClick={() => openInstance(child.id)}><ArrowRight size={14} /><span><strong>{child.businessKey || child.name || child.id}</strong><code>{child.id}</code></span></button>)}
        {!snapshot.children.complete && <p className="runtime-warning">{snapshot.children.error ? text(snapshot.children.error) : t('Список дочерних экземпляров неполный.')}</p>}
      </details>}
    </div>
    <nav className="runtime-tabs"><button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>{t('История выполнения')}</button><button aria-pressed={tab === 'variables'} onClick={() => setTab('variables')}>{t('Сохранённые переменные')}</button></nav>
    <div className="runtime-detail-body">{tab === 'history' ? <HistoryList snapshot={snapshot} xml={xml} selected={selected} focus={focus} openInstance={openInstance} /> : <>
      <p className="history-note">{t('Последние сохранённые значения. Это не значения на момент выбранного шага; история изменений переменных здесь не загружается.')}</p>
      {!snapshot.variables.complete && <p className="runtime-warning">{snapshot.variables.error ? text(snapshot.variables.error) : t('Список переменных неполный.')}</p>}
      <Variables variables={snapshot.variables.data} unavailable={!!snapshot.variables.error && !snapshot.variables.data.length} />
    </>}</div>
  </aside>;
}
