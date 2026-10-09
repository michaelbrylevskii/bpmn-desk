import { X, Plus, Trash2 } from 'lucide-react';
import type { BpmnEditor } from '../bpmn/editor';
import { namespacedValue } from '../bpmn/namespaces';
import { camundaNamespace } from '../camunda/forms';
import type { EngineId } from '../engines/contracts';
import type { ModdleElement } from '../bpmn/types';
import { useI18n } from '../i18n/provider';
import { Field } from '../ui/field';
export function DefinitionsPanel({ editor, engines, close, run }: { engines: EngineId[]; editor: BpmnEditor; close: () => void; run: (operation: () => void | Promise<void>) => void }) {
  const { t } = useI18n();
  const definitions = editor.root().get<ModdleElement[]>('rootElements').filter(value => ['bpmn:Message', 'bpmn:Signal', 'bpmn:Error', 'bpmn:Escalation'].includes(value.$type));
  return <div className="modal-backdrop"><section className="definitions-modal" role="dialog" aria-label={t("Определения BPMN")} aria-modal="true">
    <div className="panel-heading">{t("Сообщения, сигналы и ошибки")}<button className="icon-button" title={t("Закрыть определения")} onClick={close}><X size={16} /></button></div>
    <div className="definitions-scroll">{definitions.map(value => <div className="definition-card" key={value.id}>
      <div className="extension-card-heading"><code>{value.$type}</code><button className="icon-button" title={t('Удалить {name}', { name: value.id ?? '' })} onClick={() => run(() => editor.definition('', value))}><Trash2 size={14} /></button></div>
      <Field label={t("ID определения")} value={value.id ?? ''} onCommit={next => run(() => editor.updateDefinition(value, 'id', next))} />
      <Field label={t("Название определения")} value={value.name ?? ''} onCommit={next => run(() => editor.updateDefinition(value, 'name', next))} />
      {value.$type === 'bpmn:Error' && <Field label="errorCode" value={value.get<string>('errorCode') ?? ''} onCommit={next => run(() => editor.updateDefinition(value, 'errorCode', next))} />}
      {value.$type === 'bpmn:Error' && engines.includes('camunda7') && <Field label="camunda:errorMessage" value={namespacedValue(value, 'errorMessage', camundaNamespace)} onCommit={next => run(() => editor.setDefinitionAttribute(value, camundaNamespace, 'errorMessage', next))} />}
      {value.$type === 'bpmn:Escalation' && <Field label="escalationCode" value={value.get<string>('escalationCode') ?? ''} onCommit={next => run(() => editor.updateDefinition(value, 'escalationCode', next))} />}
    </div>)}{!definitions.length && <p className="muted">{t("Добавь определение, затем выбери его в свойствах события.")}</p>}</div>
    <div className="definitions-actions">{['Message', 'Signal', 'Error', 'Escalation'].map(type => <button className="button small" key={type} onClick={() => run(() => editor.definition(type))}><Plus size={13} />{type}</button>)}</div>
  </section></div>;
}
