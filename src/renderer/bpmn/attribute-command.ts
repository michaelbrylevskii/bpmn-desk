import type { DiagramElement, ModdleElement } from './types';

export interface AttributeChange { target: ModdleElement; attributes: Record<string, string> }
export interface AttributeContext { element: DiagramElement; changes: AttributeChange[]; previous?: AttributeChange[] }

/** `$attrs` — служебное поле moddle. Обычный set('$attrs') создаёт XML-атрибут
 * с этим именем. Собственная команда атомарно меняет namespace и атрибут,
 * сохраняет прежние значения и возвращает их при undo. `$attrs` в moddle
 * доступен только через getter: меняем содержимое словаря, а не ссылку.
 */
export class AttributeCommand {
  execute(context: AttributeContext): DiagramElement[] {
    context.previous = context.changes.map(change => ({ target: change.target, attributes: { ...change.target.$attrs } }));
    for (const change of context.changes) this.replace(change);
    return [context.element];
  }

  revert(context: AttributeContext): DiagramElement[] {
    for (const change of context.previous ?? []) this.replace(change);
    return [context.element];
  }

  private replace(change: AttributeChange): void {
    for (const key of Object.keys(change.target.$attrs)) delete change.target.$attrs[key];
    Object.assign(change.target.$attrs, change.attributes);
  }
}
