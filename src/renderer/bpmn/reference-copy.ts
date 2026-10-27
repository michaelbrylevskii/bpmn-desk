import type { Moddle, ModdleElement } from './types';

interface ReferenceDescriptor { businessObject?: ModdleElement; referencedRootElement?: ModdleElement }
interface ReferenceEvents {
  on(name: 'copyPaste.copyElement', priority: number, listener: (event: { descriptor: ReferenceDescriptor }) => void): void;
  on(name: 'copyPaste.pasteElement', priority: number, listener: (event: { descriptor: ReferenceDescriptor; cache: object }) => void): void;
}
interface ModdleCopy {
  copyElement(source: ModdleElement, target: ModdleElement, properties?: string[], clone?: boolean): ModdleElement;
}
interface Factory { create(type: string): ModdleElement }

/** Штатный bpmn-js считает одинаковый ID определения достаточным для его
 * повторного использования. Между документами это может подменить код ошибки
 * или сообщение. Снимок и копия определения принадлежат принимающей модели. */
export function configureReferenceCopy(events: ReferenceEvents, moddle: Moddle, copy: ModdleCopy, factory: Factory, definitions: () => ModdleElement): void {
  const originals = new WeakMap<ModdleElement, ModdleElement>();
  const imported = new WeakMap<ModdleElement, ModdleElement>();
  const pasted = new WeakMap<object, Map<string, ModdleElement>>();
  events.on('copyPaste.copyElement', 500, ({ descriptor }) => {
    const original = descriptor.referencedRootElement;
    if (!original) return;
    const snapshot = copy.copyElement(original, moddle.create(original.$type), undefined, true);
    originals.set(snapshot, original);
    descriptor.referencedRootElement = snapshot;
  });
  // После клонирования businessObject (1000), до штатного связывания (500).
  events.on('copyPaste.pasteElement', 600, ({ descriptor, cache }) => {
    const snapshot = descriptor.referencedRootElement; const bo = descriptor.businessObject;
    if (!snapshot || !bo) return;
    const root = definitions(); const roots = root.get<ModdleElement[]>('rootElements');
    const original = originals.get(snapshot) ?? imported.get(snapshot);
    let reference = original && roots.includes(original) ? original : undefined;
    if (!reference) {
      let references = pasted.get(cache);
      if (!references) { references = new Map(); pasted.set(cache, references); }
      const key = `${snapshot.$type}:${snapshot.id}`;
      reference = references.get(key);
      if (!reference) {
        reference = copy.copyElement(snapshot, factory.create(snapshot.$type));
        reference.$parent = root;
        references.set(key, reference);
      }
    }
    const targets = [bo, ...(bo.get<ModdleElement[]>('eventDefinitions') ?? [])];
    const properties: Record<string, string> = { 'bpmn:Error': 'errorRef', 'bpmn:Escalation': 'escalationRef', 'bpmn:Message': 'messageRef', 'bpmn:Signal': 'signalRef' };
    const property = properties[reference.$type];
    const target = property && targets.find(target => target.$descriptor.properties.some(item => item.name === property));
    if (target) {
      imported.set(snapshot, reference);
      target.set(property, reference);
      // Добавление/удаление определения остаётся в штатных shape.create undo/redo.
      delete descriptor.referencedRootElement;
    }
  });
}
