import { SlidersHorizontal, Braces } from 'lucide-react';
import type { BpmnEditor, EditorSnapshot } from '../bpmn/editor';
import type { ModdleElement } from '../bpmn/types';
import { engineProfiles } from '../engines/profiles';
import { useI18n } from '../i18n/provider';
import { EngineProperties } from './engine-properties';
import { CamundaExtensions } from './camunda-extensions';
import { CustomProperties } from './custom-properties';
import { ExtensionList } from './extension-list';
import { ExtensionsEditor } from './extensions-editor';
import { StandardProperties } from './standard-properties';
export function PropertiesPanel({ editor, snapshot, dark, run }: { editor: BpmnEditor; snapshot: EditorSnapshot; dark: boolean; run: (operation: () => void | Promise<void>) => void }) {
  const { t } = useI18n();
  const element = snapshot.selected;
  if (!element) return <aside className="properties"><div className="panel-heading"><SlidersHorizontal size={16} />{t("Свойства")}</div><div className="properties-empty"><SlidersHorizontal size={30} /><h3>{t("Выбери элемент")}</h3><p>{t("Его BPMN и свойства движка появятся здесь.")}</p></div></aside>;
  const layout = snapshot.diagnostics.find(item => item.action === 'arrange-boundaries' && (item.elementId === element.id || item.elementId === element.businessObject.get<ModdleElement | undefined>('attachedToRef')?.id));
  const targets = [element.businessObject, ...(element.businessObject.get<ModdleElement[]>('eventDefinitions') ?? []), ...(element.businessObject.get<ModdleElement | undefined>('loopCharacteristics') ? [element.businessObject.get<ModdleElement>('loopCharacteristics')] : [])];
  return <aside className="properties">
    <div className="panel-heading"><SlidersHorizontal size={16} />{t("Свойства")}<span className="badge">{element.type.replace('bpmn:', '')}</span></div>
    <div className="properties-scroll" key={element.id}>
      {layout?.elementId && <div className="layout-notice"><p>{t("Граничные события перекрывают маркер или друг друга.")}</p><button className="button small" onClick={() => run(() => editor.arrangeBoundaries(layout.elementId!))}>{t("Разнести события")}</button></div>}
      <details open><summary>{t("Основные · BPMN")}</summary><div className="property-group"><StandardProperties element={element} editor={editor} run={run} /></div></details>
      {snapshot.engines.map(id => <section className="engine-profile" data-profile={id} key={id} aria-label={engineProfiles[id].title}>
        {targets.map((target, index) => <EngineProperties key={index} element={element} target={target} profile={engineProfiles[id]} editor={editor} run={run} />)}
        {id === 'flowable' ? ['executionListener', ...(element.type === 'bpmn:UserTask' ? ['taskListener', 'formProperty'] : []), ...(element.type === 'bpmn:CallActivity' ? ['in', 'out'] : []), 'field'].map(kind =>
          <ExtensionList key={kind} kind={kind} element={element} editor={editor} run={run} />) : targets.map((target, index) => <CamundaExtensions key={index} element={element} target={target} editor={editor} run={run} />)}
      </section>)}
      <details><summary><Braces size={14} />{t("Дополнительные атрибуты")}</summary><div className="property-group"><CustomProperties element={element} editor={editor} run={run} /></div></details>
      <details><summary><Braces size={14} />{t("XML расширений")}</summary><div className="property-group"><ExtensionsEditor element={element} editor={editor} xml={snapshot.xml} dark={dark} run={run} /></div></details>
    </div>
  </aside>;
}
