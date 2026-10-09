import { cloneExtension, extensionChildren } from './extensions';
import type { Moddle, ModdleElement } from './types';
import { modelElements } from './diagnostics';

interface CopyProperties { sourceElement: ModdleElement; targetElement: ModdleElement }
interface CopyProperty { property: unknown; parent: ModdleElement }
interface PasteElement { descriptor: { businessObject?: ModdleElement } }
export interface ExtensionId { uri: string; name: string }
interface CopyEvents {
  on(name: 'moddleCopy.canCopyProperties', priority: number, listener: (context: CopyProperties) => void): void;
  on(name: 'moddleCopy.canCopyProperty', priority: number, listener: (context: CopyProperty) => ModdleElement | undefined): void;
  on(name: 'copyPaste.pasteElement', priority: number, listener: (context: PasteElement) => void): void;
}

/** bpmn-js по умолчанию пропускает generic XML при replace/copy-paste.
 * Обработчики участвуют в штатных командах, исходные объекты не изменяются. */
export function configureModelCopy(events: CopyEvents, moddle: Moddle, identifiedExtensions: readonly ExtensionId[] = []): void {
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
  // ID расширений, наследующих BPMN BaseElement, глобальны. ID formField/property
  // и неизвестных пользовательских узлов имеют другую область и сохраняются.
  events.on('copyPaste.pasteElement', 500, ({ descriptor }) => {
    if (!descriptor.businessObject) return;
    const visit = (node: ModdleElement) => {
      if (node.id && identifiedExtensions.some(type => node.$descriptor.ns?.uri === type.uri && node.$descriptor.ns.localName === type.name)) node.id = `${node.id}_copy_${crypto.randomUUID().replaceAll('-', '')}`;
      extensionChildren(node).forEach(visit);
    };
    modelElements(descriptor.businessObject).filter(node => node.$descriptor.isGeneric).forEach(visit);
  });
}
