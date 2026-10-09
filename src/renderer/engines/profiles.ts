import { camundaFieldsFor, camundaNamespace } from '../camunda/forms';
import { flowableNamespace } from '../flowable/attributes';
import { fieldsFor, labels } from '../flowable/forms';
import { elements, requireBpmn } from '../bpmn/xml';
import type { EngineId, EngineProfile } from './contracts';

export const engineProfiles: Record<EngineId, EngineProfile> = {
  flowable: { id: 'flowable', title: 'Flowable', ...flowableNamespace, fieldsFor: element => {
    const fields = fieldsFor(element);
    return [...fields.strings.map(name => ({ name, label: labels[name] })),
      ...fields.booleans.map(name => ({ name, label: labels[name], type: 'boolean' as const }))];
  } },
  camunda7: { id: 'camunda7', title: 'Camunda 7', ...camundaNamespace, fieldsFor: camundaFieldsFor },
};

/** Использованные URI важнее неиспользуемых объявлений, оставшихся от другого редактора. */
export function detectEngines(xml: string): EngineId[] {
  const nodes = elements(requireBpmn(xml));
  const used = new Set(nodes.flatMap(element => [element.namespaceURI, ...Array.from(element.attributes).map(attribute => attribute.namespaceURI)]));
  const profiles = Object.values(engineProfiles);
  const active = profiles.filter(profile => used.has(profile.uri));
  if (active.length) return active.map(profile => profile.id);
  const declared = new Set(nodes.flatMap(element => Array.from(element.attributes).filter(attribute => attribute.namespaceURI === 'http://www.w3.org/2000/xmlns/').map(attribute => attribute.value)));
  return profiles.filter(profile => declared.has(profile.uri)).map(profile => profile.id);
}
