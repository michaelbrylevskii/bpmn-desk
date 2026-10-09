import type { DiagramElement, ModdleElement } from './types';

interface PropertyContext { element: DiagramElement; moddleElement?: ModdleElement; properties: Record<string, unknown> }
interface PropertyEvent { context: PropertyContext }
interface PropertyEvents { on(name: string, listener: (event: PropertyEvent) => void): void }

/** Стандартный undo bpmn-js записывает prototype default как собственное значение.
 * Восстанавливаем отсутствие поля после стандартного revert, чтобы панель точно
 * различала заданное false/0 и умолчание. Семантика и команды остаются штатными. */
export function configurePropertyPresence(events: PropertyEvents): void {
  const absent = new WeakMap<PropertyContext, string[]>();
  for (const command of ['element.updateProperties', 'element.updateModdleProperties']) {
    events.on(`commandStack.${command}.preExecute`, ({ context }) => {
      const target = context.moddleElement ?? context.element.businessObject;
      absent.set(context, Object.keys(context.properties).filter(key => key !== 'di' && !Object.hasOwn(target, key)));
    });
    events.on(`commandStack.${command}.reverted`, ({ context }) => {
      const target = context.moddleElement ?? context.element.businessObject;
      for (const key of absent.get(context) ?? []) delete target[key];
    });
  }
}
