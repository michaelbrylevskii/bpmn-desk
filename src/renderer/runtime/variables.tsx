import { useState } from 'react';
import type { Variable } from '../../shared/runtime';
import { useI18n } from '../i18n/provider';
function VariableItem({ variable }: { variable: Variable }) {
  const { t } = useI18n(); const [open, setOpen] = useState(false);
  return <details className="runtime-variable" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><strong>{variable.name}</strong><span>{variable.type} · {variable.scope || 'global'}</span></summary>
    {open && (variable.binary ? <p>{t('Бинарное значение не загружено')}</p> : <pre>{typeof variable.value === 'string' ? variable.value : JSON.stringify(variable.value, null, 2)}</pre>)}
  </details>;
}
export function Variables({ variables, unavailable = false }: { variables: Variable[]; unavailable?: boolean }) {
  const { t } = useI18n(); const [search, setSearch] = useState('');
  const filtered = variables.filter(item => item.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  return <div className="runtime-variables"><input aria-label={t('Поиск')} placeholder={t('Поиск')} value={search} onChange={event => setSearch(event.target.value)} />
    {!filtered.length && <p className="runtime-empty">{t(unavailable ? 'Состояние недоступно' : variables.length ? 'Нет результатов' : 'Нет переменных')}</p>}
    {filtered.map((item, index) => <VariableItem key={`${item.scope}:${item.name}:${index}`} variable={item} />)}
  </div>;
}
