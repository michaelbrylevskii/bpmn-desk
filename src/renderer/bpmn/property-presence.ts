import type { DiagramElement, ModdleElement } from './types';

interface PropertyContext { element: DiagramElement; moddleElement?: ModdleElement; properties: Record<string, unknown> }
interface PropertyEvent { context: PropertyContext }
interface PropertyEvents {
  on(name: string, listener: (event: PropertyEvent) => void): void;
  on(name: string, priority: number, listener: (event: PropertyEvent) => void): void;
}

/** Стандартный undo bpmn-js записывает prototype default как собственное значение.
 * Восстанавливаем отсутствие поля после стандартного revert, чтобы панель точно
 * различала заданное false/0 и умолчание. Семантика и команды остаются штатными. */
export function configurePropertyPresence(events: PropertyEvents): void {
  const absent = new WeakMap<PropertyContext, string[]>();
  const absentLabels = new WeakMap<PropertyContext, ModdleElement>();
  events.on('commandStack.element.updateLabel.preExecute', 1500, ({ context }) => {
    const di = (context.element.labelTarget ?? context.element).di;
    if (di && !di.get('label')) absentLabels.set(context, di);
  });
  // BpmnUpdater создаёт BPMNLabel и на revert для непустого названия.
  // После штатного revert возвращаем исходное отсутствие DI-узла.
  events.on('commandStack.element.updateLabel.reverted', 500, ({ context }) => {
    const di = absentLabels.get(context);
    if (di) delete di.label;
  });
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
