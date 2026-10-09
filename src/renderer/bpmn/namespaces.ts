import type { ModdleElement } from './types';

/** Разрешение префиксов с учётом ближайшего объявления и его переопределений. */
export function namespaceUri(element: ModdleElement, prefix: string): string | undefined {
  for (let owner: ModdleElement | undefined = element; owner; owner = owner.$parent) {
    const value = owner.$attrs?.[`xmlns:${prefix}`] ?? owner[`xmlns:${prefix}`];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

export interface Namespace { uri: string; prefix: string }

export function namespacePrefix(element: ModdleElement, namespace: Namespace): string {
  const seen = new Set<string>();
  for (let owner: ModdleElement | undefined = element; owner; owner = owner.$parent) {
    const declarations = { ...owner.$attrs, ...Object.fromEntries(Object.entries(owner).filter(([key]) => key.startsWith('xmlns:'))) };
    for (const [key, value] of Object.entries(declarations)) {
      if (!key.startsWith('xmlns:')) continue;
      const prefix = key.slice(6);
      if (!seen.has(prefix) && value === namespace.uri) return prefix;
      seen.add(prefix);
    }
  }
  let prefix = namespace.prefix;
  for (let suffix = 2; namespaceUri(element, prefix) && namespaceUri(element, prefix) !== namespace.uri; suffix++) prefix = `${namespace.prefix}${suffix}`;
  return prefix;
}

export function namespacedKey(element: ModdleElement, name: string, namespace: Namespace): string {
  const existing = Object.keys(element.$attrs ?? {}).find(key => key.split(':')[1] === name && namespaceUri(element, key.split(':')[0]!) === namespace.uri);
  return existing ?? `${namespacePrefix(element, namespace)}:${name}`;
}

export function namespacedValue(element: ModdleElement, name: string, namespace: Namespace): string {
  return element.$attrs?.[namespacedKey(element, name, namespace)] ?? '';
}
