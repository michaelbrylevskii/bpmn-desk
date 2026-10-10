import { Select } from '../ui/select';
import type { BpmnEditor } from '../bpmn/editor';
import type { ExtensionPath } from '../bpmn/extension-commands';
import { extensionChildren, isExtension } from '../bpmn/extensions';
import type { DiagramElement, ModdleElement } from '../bpmn/types';
import { camundaNamespace } from '../camunda/forms';
import { useI18n } from '../i18n/provider';
import { Field } from '../ui/field';

export function CamundaFieldValue({ element, target = element.businessObject, value, path, editor, run }: {
  target?: ModdleElement;
  element: DiagramElement; value: ModdleElement; path: ExtensionPath; editor: BpmnEditor; run: (operation: () => void | Promise<void>) => void;
}) {
  const { t } = useI18n();
  const child = extensionChildren(value).find(node => isExtension(node, camundaNamespace.uri, 'string') || isExtension(node, camundaNamespace.uri, 'expression'));
  const kind = typeof value.expression === 'string' || (child && isExtension(child, camundaNamespace.uri, 'expression')) ? 'expression' : 'string';
  const body = typeof child?.$body === 'string' ? child.$body : typeof value.expression === 'string' ? value.expression : typeof value.stringValue === 'string' ? value.stringValue : '';
  const commit = (type: string, text: string) => run(() => editor.extensions.fieldBody(element, path, camundaNamespace, type, text, target));
  return <><label className="field"><span>{t('Тип значения')}</span><Select label={t('Тип значения')} value={kind} onChange={value => commit(value, body)} options={[{ value: 'string', label: t('Строка') }, { value: 'expression', label: t('Выражение') }]} /></label>
    <Field label={t('Значение поля')} multiline value={body} presence={child || Object.hasOwn(value, 'expression') || Object.hasOwn(value, 'stringValue') ? 'explicit' : 'unset'} onCommit={text => commit(kind, text)} /></>;
}
