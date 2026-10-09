import { Plus } from 'lucide-react';
import type { BpmnEditor } from '../bpmn/editor';
import { extensionValues, isExtension } from '../bpmn/extensions';
import type { DiagramElement, ModdleElement } from '../bpmn/types';
import { camundaExtensions, rootExtensionsFor } from '../camunda/extensions';
import { camundaNamespace } from '../camunda/forms';
import { useI18n } from '../i18n/provider';
import { CamundaExtensionNode } from './camunda-extension-node';

export function CamundaExtensions({ element, target = element.businessObject, editor, run }: { target?: ModdleElement; element: DiagramElement; editor: BpmnEditor; run: (operation: () => void | Promise<void>) => void }) {
  const { t } = useI18n();
  const values = extensionValues(target);
  const names = new Set([...rootExtensionsFor(target), ...values.filter(value => value.$descriptor.ns?.uri === camundaNamespace.uri && camundaExtensions[value.$descriptor.ns.localName]?.title).map(value => value.$descriptor.ns!.localName)]);
  return <div data-extension-target={target.$type}>{[...names].map(kind => {
    const definition = camundaExtensions[kind]!;
    const entries = values.map((value, index) => ({ value, index })).filter(({ value }) => isExtension(value, camundaNamespace.uri, kind));
    const single = ['inputOutput', 'formData', 'properties', 'connector'].includes(kind);
    return <details key={kind} className="camunda-extensions" data-extension-kind={kind}><summary>{definition.title ? t(definition.title) : kind}<span className="badge">{entries.length}</span></summary><div className="property-group">
      {entries.map(({ value, index }) => <CamundaExtensionNode target={target} key={index} element={element} value={value} path={[index]} editor={editor} run={run} />)}
      {(!single || !entries.length) && <button className="button small" onClick={() => run(() => editor.extensions.add(element, camundaNamespace, kind, definition.defaults, [], target))}><Plus size={13} />{t('Добавить {name}', { name: kind })}</button>}
    </div></details>;
  })}</div>;
}
