import { useEffect, useState } from 'react';
import { Select } from './select';
import { useI18n } from '../i18n/provider';
export type Presence = 'explicit' | 'default' | 'unset';

export function Field({ label, value, onCommit, multiline, placeholder, hint, presence = value ? 'explicit' : 'unset' }: {
  label: string; value: string; onCommit: (value: string) => void; multiline?: boolean; placeholder?: string; hint?: string; presence?: Presence;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const props = { value: draft, placeholder, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
    onBlur: () => { if (draft !== value) onCommit(draft); } };
  return <label className="field" data-presence={presence}><span>{label}</span>{multiline ? <textarea {...props} aria-label={label} rows={3} /> : <input {...props} aria-label={label} />}{hint && <small>{hint}</small>}</label>;
}

export function BooleanField({ label, value, onCommit, presence = value ? 'explicit' : 'unset', defaultValue }: {
  label: string; value: string; onCommit: (value: string) => void; presence?: Presence; defaultValue?: string;
}) {
  const { t } = useI18n();
  return <label className="field compact" data-presence={presence}><span>{label}</span><Select label={label} value={presence === 'explicit' ? value : ''} onChange={onCommit} options={[
    { value: '', label: defaultValue === undefined ? t('Не задано') : t('По умолчанию: {value}', { value: defaultValue === 'true' ? t('Да') : t('Нет') }) },
    { value: 'true', label: t('Да') }, { value: 'false', label: t('Нет') },
  ]} /></label>;
}
