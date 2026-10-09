import type { BpmnEditor } from '../bpmn/editor';
import { extensionValues, isExtension } from '../bpmn/extensions';
import { namespacedKey, namespacedValue } from '../bpmn/namespaces';
import type { DiagramElement, ModdleElement } from '../bpmn/types';
import type { EngineProfile } from '../engines/contracts';
import { useI18n } from '../i18n/provider';
import { BooleanField, Field } from '../ui/field';

export function EngineProperties({ element, target = element.businessObject, profile, editor, run }: {
  element: DiagramElement; target?: ModdleElement; profile: EngineProfile; editor: BpmnEditor; run: (operation: () => void | Promise<void>) => void;
}) {
  const { t } = useI18n();
  const retry = extensionValues(target).find(value => isExtension(value, profile.uri, 'failedJobRetryTimeCycle'));
  const fields = profile.fieldsFor(target);
  if (!fields.length && !retry) return null;
  return <details open className="engine-properties" data-engine={profile.id}><summary><span className="flowable-dot" />{profile.title}{target !== element.businessObject && <span className="badge">{target.$type.replace('bpmn:', '')}</span>}</summary><div className="property-group">
    {fields.map(field => {
      const value = namespacedValue(target, field.name, profile);
      const presence = Object.hasOwn(target.$attrs, namespacedKey(target, field.name, profile)) ? 'explicit' : 'unset';
      const label = field.label ? t(field.label) : field.name;
      const commit = (next: string) => run(() => editor.setEngineAttribute(element, profile, field.name, next, target));
      if (field.type === 'boolean') return <BooleanField key={field.name} label={label} presence={presence} value={value} defaultValue={field.defaultValue} onCommit={commit} />;
      if (field.options) return <label className="field" data-presence={presence} key={field.name}><span>{label}</span><select aria-label={label} value={value} onChange={event => commit(event.target.value)}>
        <option value="">{t('Не задано')}</option>{[...new Set([...field.options, ...(value ? [value] : [])])].map(option => <option key={option} value={option}>{option}</option>)}
      </select><small>{profile.prefix}:{field.name}</small></label>;
      return <Field key={field.name} label={label} presence={presence} hint={`${profile.prefix}:${field.name}`} value={value} onCommit={commit} />;
    })}
    <Field label={t('Повторные попытки')} hint={t('failedJobRetryTimeCycle · например R3/PT5M')} presence={retry ? 'explicit' : 'unset'} value={typeof retry?.$body === 'string' ? retry.$body : ''} onCommit={value => run(() => editor.setRetry(element, value, profile, target))} />
  </div></details>;
}
