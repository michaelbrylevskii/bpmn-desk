import { Plus, Trash2 } from 'lucide-react';
import type { BpmnEditor } from '../bpmn/editor';
import type { ExtensionPath } from '../bpmn/extension-commands';
import { extensionChildren, isExtension } from '../bpmn/extensions';
import type { DiagramElement, ModdleElement } from '../bpmn/types';
import { availableChildren, camundaExtensions } from '../camunda/extensions';
import { camundaNamespace } from '../camunda/forms';
import { useI18n } from '../i18n/provider';
import { Field } from '../ui/field';
import { CamundaFieldValue } from './camunda-value';

export interface ExtensionNodeProps { target?: ModdleElement; element: DiagramElement; value: ModdleElement; path: ExtensionPath; editor: BpmnEditor; run: (operation: () => void | Promise<void>) => void }

/** Форма одного известного XML-узла; неизвестные дети остаются в модели. */
export function CamundaExtensionNode({ element, target = element.businessObject, value, path, editor, run }: ExtensionNodeProps) {
  const { t } = useI18n();
  const kind = value.$descriptor.ns?.localName ?? value.$type;
  const definition = value.$descriptor.ns?.uri === camundaNamespace.uri ? camundaExtensions[kind] : undefined;
  const children = extensionChildren(value);
  const commit = (changes: Record<string, unknown>) => run(() => editor.extensions.edit(element, path, changes, target));
  const choices = definition ? availableChildren(value, definition) : [];
  const valueType = ['script', 'list', 'map'].find(name => children.some(node => isExtension(node, camundaNamespace.uri, name))) ?? 'text';
  return <div className="extension-card" data-extension-path={path.join('.')}>
    <div className="extension-card-heading"><code>{value.$type}</code><button className="icon-button" title={t('Удалить {name}', { name: kind })} onClick={() => run(() => editor.extensions.remove(element, path, target))}><Trash2 size={13} /></button></div>
    {!definition ? <p className="muted">{t('Редактирование доступно в XML расширений.')}</p> : <>
      {definition.fields.map(name => <Field key={name} label={`${kind}: ${name}`} value={typeof value[name] === 'string' ? value[name] : ''} presence={Object.hasOwn(value, name) ? 'explicit' : 'unset'}
        onCommit={next => commit({ [name]: next, ...(kind === 'script' && name === 'resource' && next ? { $body: undefined } : {}) })} />)}
      {kind === 'field' && <CamundaFieldValue target={target} element={element} value={value} path={path} editor={editor} run={run} />}
      {definition.value && <label className="field"><span>{t('Тип значения')}</span><select aria-label={t('Тип значения')} value={valueType} onChange={event => run(() => editor.extensions.valueType(element, path, camundaNamespace, event.target.value, target))}>
        <option value="text">{t('Строка')} / {t('Выражение')}</option><option value="script">script</option><option value="list">list</option><option value="map">map</option>
      </select></label>}
      {(definition.body || (definition.value && valueType === 'text')) && !(kind === 'script' && value.resource) && <Field label={t('Текст · {name}', { name: kind })} multiline value={typeof value.$body === 'string' ? value.$body : ''} presence={Object.hasOwn(value, '$body') ? 'explicit' : 'unset'} onCommit={body => commit({ $body: body })} />}
      {children.map((child, index) => kind === 'field' && ['string', 'expression'].some(name => isExtension(child, camundaNamespace.uri, name)) ? null : <CamundaExtensionNode target={target} key={index} element={element} value={child} path={[...path, index]} editor={editor} run={run} />)}
      {choices.length > 0 && <div className="extension-additions">{choices.map(choice => <button className="button small" key={choice.name} onClick={() => run(() => {
        const defaults = { ...camundaExtensions[choice.name]?.defaults };
        if (['formField', 'formProperty'].includes(choice.name)) {
          const used = new Set(children.map(child => child.id));
          let id = defaults.id ?? 'field';
          for (let suffix = 2; used.has(id); suffix++) id = `${defaults.id}${suffix}`;
          defaults.id = id;
        }
        editor.extensions.add(element, camundaNamespace, choice.name, defaults, path, target);
      })}><Plus size={12} />{t('Добавить {name}', { name: choice.name })}</button>)}</div>}
    </>}
  </div>;
}
