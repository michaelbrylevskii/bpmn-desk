import { Plus, Trash2 } from 'lucide-react';
import type { MessageKey } from '../../shared/i18n';
import type { BpmnEditor } from '../bpmn/editor';
import type { DiagramElement, ModdleElement } from '../bpmn/types';
import { extensionValues, isFlowableExtension } from '../flowable/extensions';
import { useI18n } from '../i18n/provider';
import { Field } from '../ui/field';
const definitions: Record<string, { title: MessageKey; fields: string[]; defaults: Record<string, string> }> = {
  executionListener: { title: 'Обработчики процесса · executionListener', fields: ['event', 'class', 'expression', 'delegateExpression', 'onTransaction'], defaults: { event: 'start' } },
  taskListener: { title: 'Обработчики задачи · taskListener', fields: ['event', 'class', 'expression', 'delegateExpression'], defaults: { event: 'create' } },
  in: { title: 'Входные параметры · in', fields: ['source', 'sourceExpression', 'target', 'businessKey', 'local'], defaults: { target: 'variable' } },
  out: { title: 'Выходные параметры · out', fields: ['source', 'sourceExpression', 'target', 'local'], defaults: { target: 'variable' } },
  field: { title: 'Поля · field', fields: ['name'], defaults: { name: 'field' } },
  formProperty: { title: 'Поля формы · formProperty', fields: ['id', 'name', 'type', 'variable', 'expression', 'default', 'required', 'readable', 'writable'], defaults: { id: 'property', type: 'string' } },
};

export function ExtensionList({ kind, element, editor, run }: { kind: string; element: DiagramElement; editor: BpmnEditor; run: (operation: () => void | Promise<void>) => void }) {
  const { t } = useI18n();
  const definition = definitions[kind];
  if (!definition) return null;
  const entries = extensionValues(element.businessObject).map((value, index) => ({ value, index })).filter(({ value }) => isFlowableExtension(value, kind));
  return <details><summary><span>{t(definition.title)}</span><span className="badge">{entries.length}</span></summary><div className="property-group">
    {entries.map(({ value, index }) => <div className="extension-card" key={index}>
      <div className="extension-card-heading"><code>flowable:{kind}</code><button className="icon-button" title={t('Удалить {name}', { name: kind })} onClick={() => run(() => editor.removeExtension(element, index))}><Trash2 size={13} /></button></div>
      {definition.fields.map(name => <Field key={name} label={`${kind}: ${name}`} presence={Object.hasOwn(value, name) ? 'explicit' : 'unset'} value={typeof value[name] === 'string' ? value[name] : ''}
        onCommit={next => run(() => editor.editExtension(element, index, { [name]: next }))} />)}
      {kind === 'field' && <FieldBody value={value} onCommit={(type, body) => run(() => editor.editFieldBody(element, index, type, body))} />}
    </div>)}
    <button className="button small" onClick={() => run(() => editor.addExtension(element, kind, definition.defaults))}><Plus size={13} />{t('Добавить {name}', { name: kind })}</button>
  </div></details>;
}

function FieldBody({ value, onCommit }: { value: ModdleElement; onCommit: (type: string, body: string) => void }) {
  const { t } = useI18n();
  const child = (value.$children as ModdleElement[] ?? []).find(item => isFlowableExtension(item, 'expression') || isFlowableExtension(item, 'string'));
  const type = child && isFlowableExtension(child, 'expression') ? 'expression' : 'string';
  const body = typeof child?.$body === 'string' ? child.$body : '';
  return <><label className="field"><span>{t("Тип значения")}</span><select value={type} onChange={event => onCommit(event.target.value, body)}><option value="string">{t("Строка")}</option><option value="expression">{t("Выражение")}</option></select></label>
    <Field label={t("Значение поля")} value={body} multiline onCommit={text => onCommit(type, text)} /></>;
}
