import type { ModdleElement } from '../bpmn/types';
import { FLOWABLE_URI } from './descriptor';

export function attributeKey(element: ModdleElement, localName: string): string {
  let owner: ModdleElement | undefined = element;
  while (owner) {
    for (const [key, value] of Object.entries(owner.$attrs ?? {})) {
      if (key.startsWith('xmlns:') && value === FLOWABLE_URI) return `${key.slice(6)}:${localName}`;
    }
    owner = owner.$parent;
  }
  return `flowable:${localName}`;
}

export function flowableValue(element: ModdleElement, name: string): string {
  return element.$attrs?.[attributeKey(element, name)] ?? '';
}

export function namespaceUri(element: ModdleElement, prefix: string): string | undefined {
  if (prefix === 'flowable') return FLOWABLE_URI;
  let owner: ModdleElement | undefined = element;
  while (owner) {
    const value = owner.$attrs?.[`xmlns:${prefix}`];
    if (value) return value;
    owner = owner.$parent;
  }
  return undefined;
}
