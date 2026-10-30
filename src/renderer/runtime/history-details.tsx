import type { Instance } from '../../shared/runtime';
import { useState } from 'react';
import { InstanceRelationships } from './relationships';
import type { HistorySnapshot } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { Variables } from './variables';
import { HistoryList } from './history-list';
import { historyDuration, historyTime } from './history-format';

export function HistoryDetails({ connection, snapshot, xml, selected, focus, openInstance }: {
  connection: string; snapshot: HistorySnapshot; xml?: string; selected: string; focus: (id: string) => void; openInstance: (id: string, preview?: Instance) => void;
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
      <InstanceRelationships connection={connection} parent={process.superProcessInstanceId} children={snapshot.children.data} incomplete={!snapshot.children.complete} open={openInstance} />
    </div>
    <nav className="runtime-tabs"><button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>{t('История выполнения')}</button><button aria-pressed={tab === 'variables'} onClick={() => setTab('variables')}>{t('Сохранённые переменные')}</button></nav>
    <div className="runtime-detail-body">{tab === 'history' ? <HistoryList snapshot={snapshot} xml={xml} selected={selected} focus={focus} openInstance={openInstance} /> : <>
      <p className="history-note">{t('Последние сохранённые значения. Это не значения на момент выбранного шага; история изменений переменных здесь не загружается.')}</p>
      {!snapshot.variables.complete && <p className="runtime-warning">{snapshot.variables.error ? text(snapshot.variables.error) : t('Список переменных неполный.')}</p>}
      <Variables variables={snapshot.variables.data} unavailable={!!snapshot.variables.error && !snapshot.variables.data.length} />
    </>}</div>
  </aside>;
}
