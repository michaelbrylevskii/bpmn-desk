import type { ModdleElement } from './types';
import { preservationIssues } from './xml';

/** Привязка к объектам сохраняет защиту при rename и его undo/redo. */
export class PreservationGuard {
  private source = '';
  private readonly originals = new Map<ModdleElement, string>();
  private readonly allowed = new Set<string>();

  reset(xml: string, items: ModdleElement[]): void {
    this.source = xml; this.originals.clear(); this.allowed.clear();
    for (const item of items) if (item.id || item.$type === 'bpmn:Definitions') this.originals.set(item, item.id ?? '@definitions');
  }

  allow(element: ModdleElement, key: string): void {
    this.allowed.add(`${this.originals.get(element) ?? element.id}|${key}`);
  }

  issues(xml: string, current: ModdleElement[]): string[] {
    const existing = new Set(current);
    const aliases = new Map<string, string>();
    for (const [element, original] of this.originals) if (existing.has(element)) aliases.set(original, element.id ?? '@definitions');
    return preservationIssues(this.source, xml, this.allowed, aliases);
  }
}
