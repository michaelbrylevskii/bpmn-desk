import { SlidersHorizontal, Braces } from 'lucide-react';
import type { BpmnEditor, EditorSnapshot } from '../bpmn/editor';
import type { ModdleElement } from '../bpmn/types';
import { attributeKey, flowableValue } from '../flowable/attributes';
import { fieldsFor, labels } from '../flowable/forms';
import { useI18n } from '../i18n/provider';
import { Field, BooleanField } from '../ui/field';
import { CustomProperties } from './custom-properties';
import { ExtensionList } from './extension-list';
import { ExtensionsEditor } from './extensions-editor';
import { StandardProperties } from './standard-properties';
export function PropertiesPanel({ editor, snapshot, dark, run }: { editor: BpmnEditor; snapshot: EditorSnapshot; dark: boolean; run: (operation: () => void | Promise<void>) => void }) {
  const { t, text } = useI18n();
  const element = snapshot.selected;
  if (!element) return <aside className="properties"><div className="panel-heading"><SlidersHorizontal size={16} />{t("Свойства")}</div><div className="properties-empty"><SlidersHorizontal size={30} /><h3>{t("Выбери элемент")}</h3><p>{t("Его BPMN, Flowable и дополнительные свойства появятся здесь.")}</p></div></aside>;
  const layout = snapshot.diagnostics.find(item => item.action === 'arrange-boundaries' && (item.elementId === element.id || item.elementId === element.businessObject.get<ModdleElement | undefined>('attachedToRef')?.id));
  const fields = fieldsFor(element.businessObject);
  const retry = element.businessObject.get<ModdleElement | undefined>('extensionElements')?.get<ModdleElement[]>('values')
    ?.find(value => value.$type.endsWith(':failedJobRetryTimeCycle'))?.$body;
  return <aside className="properties">
    <div className="panel-heading"><SlidersHorizontal size={16} />{t("Свойства")}<span className="badge">{element.type.replace('bpmn:', '')}</span></div>
    <div className="properties-scroll" key={element.id}>
      {layout?.elementId && <div className="layout-notice"><p>{t("Граничные события перекрывают маркер или друг друга.")}</p><button className="button small" onClick={() => run(() => editor.arrangeBoundaries(layout.elementId!))}>{t("Разнести события")}</button></div>}
      <details open><summary>{t("Основные · BPMN")}</summary><div className="property-group"><StandardProperties element={element} editor={editor} run={run} /></div></details>
      <details open><summary><span className="flowable-dot" />Flowable</summary><div className="property-group">
        {fields.strings.map(name => <Field key={name} label={text(labels[name] ?? name)} presence={Object.hasOwn(element.businessObject.$attrs, attributeKey(element.businessObject, name)) ? 'explicit' : 'unset'} hint={`flowable:${name}`} value={flowableValue(element.businessObject, name)}
          onCommit={value => run(() => editor.setFlowable(element, name, value))} />)}
        {fields.booleans.map(name => <BooleanField key={name} label={text(labels[name] ?? name)} presence={Object.hasOwn(element.businessObject.$attrs, attributeKey(element.businessObject, name)) ? 'explicit' : 'unset'} value={flowableValue(element.businessObject, name)} onCommit={value => run(() => editor.setFlowable(element, name, value))} />)}
        <Field label={t("Повторные попытки")} hint={t("failedJobRetryTimeCycle · например R3/PT5M")} value={typeof retry === 'string' ? retry : ''} onCommit={value => run(() => editor.setRetry(element, value))} />
      </div></details>
      {['executionListener', ...(element.type === 'bpmn:UserTask' ? ['taskListener', 'formProperty'] : []), ...(element.type === 'bpmn:CallActivity' ? ['in', 'out'] : []), 'field'].map(kind =>
        <ExtensionList key={kind} kind={kind} element={element} editor={editor} run={run} />)}
      <details><summary><Braces size={14} />{t("Дополнительные атрибуты")}</summary><div className="property-group"><CustomProperties element={element} editor={editor} run={run} /></div></details>
      <details><summary><Braces size={14} />{t("XML расширений")}</summary><div className="property-group"><ExtensionsEditor element={element} editor={editor} xml={snapshot.xml} dark={dark} run={run} /></div></details>
    </div>
  </aside>;
}
