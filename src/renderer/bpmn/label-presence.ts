import type { DiagramElement, ModdleElement } from './types';

interface LabelContext { element?: DiagramElement; shape?: DiagramElement }
interface LabelEvents { on(name: string, priority: number, listener: (event: { context: LabelContext }) => void): void }
interface LabelSnapshot {
  di: ModdleElement;
  label?: ModdleElement;
  bounds?: ModdleElement;
  coordinates: { name: string; own: boolean; value: unknown }[];
}

/** Импортированная визуальная подпись может иметь размеры, отличные от исходной DI.
 * После undo и штатного shape.changed возвращаем именно исходные DI-данные. */
export function configureLabelPresence(events: LabelEvents): void {
  const originals = new WeakMap<LabelContext, LabelSnapshot>();
  const pending = new Map<ModdleElement, LabelSnapshot>();
  for (const command of ['element.updateLabel', 'shape.move', 'shape.resize']) {
    events.on(`commandStack.${command}.preExecute`, 1500, ({ context }) => {
      const element = context.element ?? context.shape;
      const di = (element?.labelTarget ?? element)?.di;
      if (!di) return;
      const label = di.get<ModdleElement | undefined>('label');
      const bounds = label?.get<ModdleElement | undefined>('bounds');
      originals.set(context, { di, label, bounds, coordinates: bounds ? ['x', 'y', 'width', 'height'].map(name => ({ name, own: Object.hasOwn(bounds, name), value: bounds.get(name) })) : [] });
    });
    events.on(`commandStack.${command}.reverted`, 500, ({ context }) => {
      const original = originals.get(context);
      if (original) pending.set(original.di, original);
    });
  }
  // elements.changed вызывает BpmnUpdater ещё раз после отдельных reverted.
  // Восстанавливаем DI до публикации итогового XML, сохраняя штатную геометрию UI.
  events.on('commandStack.changed', 2000, () => {
    for (const { di, label, bounds, coordinates } of pending.values()) {
      if (!label) { delete di.label; continue; }
      di.set('label', label);
      if (!bounds) { delete label.bounds; continue; }
      label.set('bounds', bounds);
      for (const { name, own, value } of coordinates) {
        if (own) bounds.set(name, value); else delete bounds[name];
      }
    }
    pending.clear();
  });
}
