import { cloneExtension, extensionChildren } from './extensions';
import type { Moddle, ModdleElement } from './types';

interface CopyProperties { sourceElement: ModdleElement; targetElement: ModdleElement }
interface CopyProperty { property: unknown; parent: ModdleElement }
interface CopyEvents {
  on(name: 'moddleCopy.canCopyProperties', priority: number, listener: (context: CopyProperties) => void): void;
  on(name: 'moddleCopy.canCopyProperty', priority: number, listener: (context: CopyProperty) => ModdleElement | undefined): void;
}

/** bpmn-js по умолчанию пропускает generic XML при replace/copy-paste.
 * Обработчики участвуют в штатных командах, исходные объекты не изменяются. */
export function configureModelCopy(events: CopyEvents, moddle: Moddle): void {
  events.on('moddleCopy.canCopyProperties', 1500, ({ sourceElement, targetElement }) => {
    Object.assign(targetElement.$attrs, sourceElement.$attrs);
  });
  const clone = (source: ModdleElement, parent: ModdleElement): ModdleElement => {
    const result = cloneExtension(moddle, source, {});
    result.$parent = parent;
    if (extensionChildren(source).length) result.$children = extensionChildren(source).map(child => clone(child, result));
    return result;
  };
  events.on('moddleCopy.canCopyProperty', 1500, ({ property, parent }) => {
    if (!property || typeof property !== 'object' || !('$descriptor' in property)) return undefined;
    const element = property as ModdleElement;
    return element.$descriptor.isGeneric ? clone(element, parent) : undefined;
  });
}
