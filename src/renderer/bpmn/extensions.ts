import type { Moddle, ModdleElement } from './types';

export function extensionValues(element: ModdleElement): ModdleElement[] {
  return element.get<ModdleElement | undefined>('extensionElements')?.get<ModdleElement[]>('values') ?? [];
}

export function isExtension(element: ModdleElement, uri: string, name: string): boolean {
  return element.$descriptor.ns?.uri === uri && element.$descriptor.ns.localName === name;
}

export function extensionChildren(element: ModdleElement): ModdleElement[] {
  return (element.$children as ModdleElement[] | undefined) ?? [];
}

/** Копируются также неизвестные атрибуты, тело и дочерние расширения. */
export function cloneExtension(moddle: Moddle, element: ModdleElement, changes: Record<string, unknown>): ModdleElement {
  const uri = element.$descriptor.ns?.uri;
  if (!uri) throw new Error('У расширения отсутствует URI пространства имён.');
  const properties = Object.fromEntries(Object.entries(element).filter(([key]) => key !== '$type'));
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined || value === '') delete properties[key]; else properties[key] = value;
  }
  return moddle.createAny(element.$type, uri, properties);
}
