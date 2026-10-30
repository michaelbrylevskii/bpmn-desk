import { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { DeadLetterJob } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
import { summaryInstances, type SummarySource } from '../bpmn/summary-model';
import type { useSummary } from './use-summary';

/** Постоянная панель определения. Выбор элемента не вызывает дополнительного HTTP. */
export function SummaryDetails({ summary, enabled, element, open }: { summary: ReturnType<typeof useSummary>; enabled: boolean; element: string; open: (id: string, history: boolean, job?: DeadLetterJob) => void }) {
  const { t, text } = useI18n(); const [source, setSource] = useState<SummarySource>('runtime');
  const [page, setPage] = useState({ element: '', runtime: 0, history: 0 });
  const data = enabled ? summary.data : undefined;
  const items = data ? summaryInstances(data, element, source) : [];
  const start = page.element === element ? page[source] : 0;
  const offset = Math.min(start, Math.max(0, Math.ceil(items.length / 10) * 10 - 10));
  const visible = items.slice(offset, offset + 10);
  const errors = data ? (source === 'history' ? [data.activities.error] : [data.executions.error, data.deadLetters.error]).filter(Boolean) : [];
  const partial = data && (source === 'history' ? !data.activities.complete : !data.executions.complete || !data.deadLetters.complete);
  const changePage = (value: number) => setPage(previous => ({ ...(previous.element === element ? previous : { element, runtime: 0, history: 0 }), [source]: value }));
  return <aside className="runtime-details runtime-summary-details">
    {!element ? <p className="runtime-empty runtime-details-placeholder">{t('Выберите элемент для просмотра подробностей')}</p> : <>
      <div className="runtime-instance"><strong>{t('Выбранный элемент')}</strong><code>{element}</code></div>
      <nav className="runtime-tabs summary-source-tabs">{(['runtime', 'history'] as const).map(value => <button key={value} aria-pressed={source === value} onClick={() => setSource(value)}>{t(value === 'runtime' ? 'Текущее состояние' : 'История')}</button>)}</nav>
      <div className="runtime-detail-body">
        {!enabled ? <p className="runtime-empty">{t('Включи сводку для просмотра экземпляров элемента.')}</p> : <>
          {summary.busy && <p className="runtime-warning" role="status">{t('Загрузка сводки…')}</p>}
          {summary.error && <p className="runtime-error" role="alert">{text(summary.error)}{data && ` ${t('Последний снимок устарел.')}`}</p>}
          {errors.map((error, i) => <p key={i} className="runtime-error" role="alert">{text(error!)}</p>)}
          {partial && <p className="runtime-warning">{t('Частичная выборка: ≥ — не менее. Отсутствие метки не означает ноль.')}</p>}
          {data && !items.length && <p className="runtime-empty">{t(errors.length ? 'Состояние недоступно' : 'В загруженной выборке нет экземпляров этого элемента.')}</p>}
          {visible.map(item => <button className={`related-instance ${item.job ? 'failed' : ''}`} key={item.id} aria-label={`${t('Открыть экземпляр')}: ${item.id}`} onClick={() => open(item.id, source === 'history', item.job)}>
            <ArrowUpRight size={15} /><span><code>{item.id}</code><strong>{t(source === 'history' ? 'История' : item.job ? 'Dead-letter jobs' : 'Executions')}</strong></span></button>)}
        </>}
      </div>
      {!!items.length && <div className="runtime-pagination"><span>{t('Показано {count} из {total}', { count: visible.length, total: items.length })}</span>
        <button className="icon-button" title={t('Предыдущая страница')} disabled={!offset} onClick={() => changePage(offset - 10)}><ChevronLeft size={16} /></button>
        <button className="icon-button" title={t('Следующая страница')} disabled={offset + visible.length >= items.length} onClick={() => changePage(offset + 10)}><ChevronRight size={16} /></button></div>}
    </>}
  </aside>;
}
