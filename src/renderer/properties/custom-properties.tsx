import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { BpmnEditor } from '../bpmn/editor';
import type { DiagramElement } from '../bpmn/types';
import { namespaceUri } from '../flowable/attributes';
import { useI18n } from '../i18n/provider';
import { Field } from '../ui/field';
export function CustomProperties({ element, editor, run }: { element: DiagramElement; editor: BpmnEditor; run: (operation: () => void | Promise<void>) => void }) {
  const { t } = useI18n();
  const [key, setKey] = useState('');
  const [uri, setUri] = useState('');
  const [value, setValue] = useState('');
  return <>
    <p className="muted">{t("Атрибуты с пространством имён. Пустое значение удаляет атрибут.")}</p>
    {Object.entries(element.businessObject.$attrs ?? {}).filter(([name]) => !name.startsWith('xmlns')).map(([name, current]) =>
      <div className="attribute-row" key={name}><Field label={name} value={current} presence="explicit" multiline
        hint={namespaceUri(element.businessObject, name.split(':')[0] ?? '')}
        onCommit={next => run(() => editor.setAttribute(element, name, next))} />
        <button className="icon-button" title={t('Удалить {name}', { name })} onClick={() => run(() => editor.setAttribute(element, name, ''))}><Trash2 size={14} /></button></div>)}
    <div className="new-attribute">
      <h4>{t("Новый атрибут")}</h4>
      <input aria-label={t("Имя атрибута")} placeholder="prefix:name" value={key} onChange={e => setKey(e.target.value)} />
      <input aria-label={t("URI пространства имён")} placeholder={t("URI namespace (для нового prefix)")} value={uri} onChange={e => setUri(e.target.value)} />
      <textarea aria-label={t("Значение атрибута")} placeholder={t("Значение")} value={value} onChange={e => setValue(e.target.value)} />
      <button className="button small" disabled={!key || !value} onClick={() => run(() => { editor.setAttribute(element, key, value, uri || undefined); setKey(''); setUri(''); setValue(''); })}><Plus size={14} />{t("Добавить")}</button>
    </div>
  </>;
}
