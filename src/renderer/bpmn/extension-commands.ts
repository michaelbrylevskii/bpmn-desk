import { cloneExtension, extensionChildren, extensionValues, isExtension } from './extensions';
import { namespacePrefix, type Namespace } from './namespaces';
import type { DiagramElement, Moddle, ModdleElement } from './types';

export type ExtensionPath = readonly number[];

/** Путь адресует containment XML. Каждая операция заменяет дерево одной командой. */
export class ExtensionCommands {
  constructor(private readonly moddle: Moddle, private readonly replace: (element: DiagramElement, values: ModdleElement[], target?: ModdleElement) => void) {}

  add(element: DiagramElement, namespace: Namespace, name: string, attributes: Record<string, string>, parent: ExtensionPath = [], target = element.businessObject): void {
    const value = this.moddle.createAny(`${namespacePrefix(target, namespace)}:${name}`, namespace.uri, attributes);
    this.change(element, parent, node => cloneExtension(this.moddle, node, { $children: [...extensionChildren(node), value] }), values => [...values, value], target);
  }

  edit(element: DiagramElement, path: ExtensionPath, changes: Record<string, unknown>, target = element.businessObject): void {
    this.change(element, path, node => cloneExtension(this.moddle, node, changes), undefined, target);
  }

  remove(element: DiagramElement, path: ExtensionPath, target = element.businessObject): void { this.change(element, path, () => undefined, undefined, target); }

  valueType(element: DiagramElement, path: ExtensionPath, namespace: Namespace, kind: string, target = element.businessObject): void {
    if (!['text', 'script', 'list', 'map'].includes(kind)) throw new Error('Неизвестный тип значения поля.');
    this.change(element, path, node => {
      const children = extensionChildren(node).filter(child => !['script', 'list', 'map'].some(name => isExtension(child, namespace.uri, name)));
      if (kind !== 'text') children.push(this.moddle.createAny(`${namespacePrefix(target, namespace)}:${kind}`, namespace.uri, kind === 'script' ? { scriptFormat: 'javascript' } : {}));
      return cloneExtension(this.moddle, node, { $children: children, $body: undefined });
    }, undefined, target);
  }

  retry(element: DiagramElement, namespace: Namespace, body: string, target = element.businessObject): void {
    const values = extensionValues(target).filter(value => !isExtension(value, namespace.uri, 'failedJobRetryTimeCycle'));
    if (body.trim()) values.push(this.moddle.createAny(`${namespacePrefix(target, namespace)}:failedJobRetryTimeCycle`, namespace.uri, { $body: body }));
    this.replace(element, values, target);
  }

  fieldBody(element: DiagramElement, path: ExtensionPath, namespace: Namespace, kind: string, body: string, target = element.businessObject): void {
    if (!['string', 'expression'].includes(kind)) throw new Error('Неизвестный тип значения поля.');
    this.change(element, path, node => {
      const children = extensionChildren(node).filter(child => !isExtension(child, namespace.uri, 'string') && !isExtension(child, namespace.uri, 'expression'));
      children.push(this.moddle.createAny(`${namespacePrefix(target, namespace)}:${kind}`, namespace.uri, { $body: body }));
      return cloneExtension(this.moddle, node, { $children: children, stringValue: undefined, expression: undefined });
    }, undefined, target);
  }

  private change(element: DiagramElement, path: ExtensionPath, modify: (node: ModdleElement) => ModdleElement | undefined, root?: (values: ModdleElement[]) => ModdleElement[], target = element.businessObject): void {
    const visit = (values: ModdleElement[], remaining: ExtensionPath): ModdleElement[] => {
      if (!remaining.length) {
        if (root) return root(values);
        throw new Error('Нужен путь к расширению.');
      }
      const index = remaining[0]!;
      if (!Number.isInteger(index) || index < 0 || index >= values.length) throw new Error('Расширение больше не существует.');
      return values.flatMap((value, i) => {
        if (i !== index) return [value];
        const next = remaining.length === 1 ? modify(value) : cloneExtension(this.moddle, value, { $children: visit(extensionChildren(value), remaining.slice(1)) });
        return next ? [next] : [];
      });
    };
    this.replace(element, visit(extensionValues(target), path), target);
  }
}
