import type { Moddle, ModdleElement } from '../bpmn/types';
import { FLOWABLE_URI } from './descriptor';

export function extensionValues(element: ModdleElement): ModdleElement[] {
  return element.get<ModdleElement | undefined>('extensionElements')?.get<ModdleElement[]>('values') ?? [];
}

export function isFlowableExtension(element: ModdleElement, name: string): boolean {
  return element.$descriptor.ns?.uri === FLOWABLE_URI && element.$descriptor.ns.localName === name;
}

export function cloneExtension(moddle: Moddle, element: ModdleElement, attributes: Record<string, string | undefined>): ModdleElement {
  const properties = Object.fromEntries(Object.entries(element).filter(([key]) => key !== '$type'));
  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === '') delete properties[key]; else properties[key] = value;
  }
  const result = moddle.createAny(element.$type, element.$descriptor.ns?.uri ?? FLOWABLE_URI, properties);
  return result;
}
