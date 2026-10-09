import type { BpmnEditor } from '../bpmn/editor';
import type { DiagramElement, ModdleElement } from '../bpmn/types';
import { useI18n } from '../i18n/provider';
import { Field, BooleanField, type Presence } from '../ui/field';
export function StandardProperties({ element, editor, run }: { element: DiagramElement; editor: BpmnEditor; run: (operation: () => void | Promise<void>) => void }) {
  const { t } = useI18n();
  const bo = element.businessObject;
  const targets = [bo, ...(bo.get<ModdleElement[]>('eventDefinitions') ?? []), ...(bo.get<ModdleElement>('loopCharacteristics') ? [bo.get<ModdleElement>('loopCharacteristics')] : [])];
  return <>
    <Field label="ID" value={bo.id ?? ''} onCommit={value => run(() => editor.update(element, 'id', value))} />
    <Field label={t("Название")} value={bo.name ?? ''} multiline onCommit={value => run(() => editor.update(element, 'name', value || undefined))} />
    {targets.map((target, index) => <section key={`${target.$type}-${index}`}>
      {index > 0 && <h4>{target.$type.replace('bpmn:', '')}</h4>}
      {target.$descriptor.properties.filter(p => !['id', 'name'].includes(p.name) && !p.isVirtual && !p.isMany &&
        ['String', 'Boolean', 'Integer', 'Real'].includes(p.type) && (p.isAttr || p.name === 'script')).map(property => {
        const value = target.get<unknown>(property.name);
        const presence: Presence = Object.hasOwn(target, property.name) ? 'explicit' : value === undefined ? 'unset' : 'default';
        return property.type === 'Boolean' ? <BooleanField key={property.name} label={property.name} presence={presence} value={value === undefined ? '' : String(value)}
          defaultValue={property.default === undefined ? undefined : String(property.default)} onCommit={v => run(() => editor.update(element, property.name, v === '' ? undefined : v === 'true', target))} /> :
          <Field key={property.name} label={property.name} presence={presence} value={value === undefined ? '' : String(value)} multiline={property.name === 'script'} onCommit={v => run(() => {
            const next = v === '' ? undefined : ['Integer', 'Real'].includes(property.type) ? Number(v) : v;
            if (typeof next === 'number' && (!Number.isFinite(next) || (property.type === 'Integer' && !Number.isInteger(next)))) throw new Error(t("Ожидается число допустимого типа."));
            editor.update(element, property.name, next, target);
          })} />;
      })}
      {target.$descriptor.properties.filter(p => p.isReference && !p.isMany && !['sourceRef', 'targetRef', 'attachedToRef', 'incoming', 'outgoing'].includes(p.name)).map(property => {
        const options = property.name === 'default' ? target.get<ModdleElement[]>('outgoing') ?? [] : editor.allModelElements().filter(item => item.id && item.$instanceOf(property.type));
        const selected = target.get<ModdleElement | undefined>(property.name)?.id ?? '';
        return <label key={property.name} className="field" data-presence={selected ? 'explicit' : 'unset'}><span>{property.name}</span><select value={selected} onChange={event => run(() => editor.update(element, property.name, options.find(item => item.id === event.target.value), target))}>
          <option value="">{t("Не задано")}</option>{options.map(item => <option key={item.id} value={item.id}>{item.name || item.id}</option>)}
        </select></label>;
      })}
      {target.$descriptor.properties.filter(p => p.type === 'bpmn:Expression' && !p.isMany).map(property =>
        <Field key={property.name} label={property.name} value={target.get<ModdleElement | undefined>(property.name)?.get<string>('body') ?? ''} multiline
          onCommit={value => run(() => editor.setExpression(element, property.name, value, target))} />)}
    </section>)}
    <Field label={t("Документация")} multiline value={bo.get<ModdleElement[]>('documentation')?.[0]?.get<string>('text') ?? ''}
      onCommit={value => run(() => {
        // Текст обновляется через XML-модель с сохранением остальных записей.
        const documentation = bo.get<ModdleElement[]>('documentation') ?? [];
        const first = documentation[0];
        if (first) editor.update(element, 'text', value, first);
        else editor.setDocumentation(element, value);
      })} />
  </>;
}
