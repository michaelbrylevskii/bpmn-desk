import type { Instance } from '../../shared/runtime';
import { useState } from 'react';
import { InstanceRelationships } from './relationships';
import type { HistorySnapshot } from '../../shared/history';
import { useI18n } from '../i18n/provider';
import { Variables } from './variables';
import { HistoryList } from './history-list';
import { InstanceFields } from './instance-fields';

export function HistoryDetails({ connection, snapshot, xml, filter, clearFilter, focus, openInstance, definition }: {
  connection: string; snapshot: HistorySnapshot; xml?: string; filter: string; clearFilter: () => void; focus: (id: string) => void; openInstance: (id: string, preview?: Instance) => void; definition: (id: string) => void;
}) {
  const { t, text } = useI18n(); const [tab, setTab] = useState<'history' | 'variables'>('history');
  const process = snapshot.instance;
  return <aside className="runtime-details history-details" aria-label={t('История выполнения')}>
    <div className="runtime-instance"><strong>{process.businessKey || process.name || process.id}</strong><code>{process.id}</code>
      <InstanceFields process={process} definition={definition} />
      <InstanceRelationships connection={connection} parent={process.superProcessInstanceId} children={snapshot.children.data} incomplete={!snapshot.children.complete} open={openInstance} />
    </div>
    <nav className="runtime-tabs"><button aria-pressed={tab === 'history'} onClick={() => setTab('history')}>{t('История выполнения')}</button><button aria-pressed={tab === 'variables'} onClick={() => setTab('variables')}>{t('Сохранённые переменные')}</button></nav>
    <div className="runtime-detail-body">{tab === 'history' ? <HistoryList snapshot={snapshot} xml={xml} filter={filter} clearFilter={clearFilter} focus={focus} openInstance={openInstance} /> : <>
      <p className="history-note">{t('Последние сохранённые значения. Это не значения на момент выбранного шага; история изменений переменных здесь не загружается.')}</p>
      {!snapshot.variables.complete && <p className="runtime-warning">{snapshot.variables.error ? text(snapshot.variables.error) : t('Список переменных неполный.')}</p>}
      <Variables variables={snapshot.variables.data} unavailable={!!snapshot.variables.error && !snapshot.variables.data.length} />
    </>}</div>
  </aside>;
}
