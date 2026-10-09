import type { Moddle, ModdleElement } from './types';
import { parseXml, elements, serializeXml } from './xml';
import { modelElements } from './diagnostics';

/** moddle-xml убирает prefix у generic attrs в namespace их тега.
 * В XML default namespace не распространяется на атрибуты. Восстанавливаем
 * квалифицированные имена из самой модели, без привязки к исходному файлу.
 */
export function repairGenericAttributes(root: ModdleElement, xml: string): string {
  const groups = new Map<string, ModdleElement[]>();
  const visit = (element: ModdleElement) => {
    if (!element.$descriptor?.isGeneric) return;
    const ns = element.$descriptor.ns;
    if (!ns) return;
    const key = `{${ns.uri}}${ns.localName}`;
    const group = groups.get(key) ?? [];
    group.push(element); groups.set(key, group);
    for (const child of element.$children as ModdleElement[] ?? []) visit(child);
  };
  for (const element of modelElements(root)) {
    if (element.$descriptor?.isGeneric) visit(element);
  }
  if (!groups.size) return xml;
  const document = parseXml(xml);
  let changed = false;
  for (const element of elements(document)) {
    const model = groups.get(`{${element.namespaceURI}}${element.localName}`)?.shift();
    if (!model) continue;
    for (const [key, value] of Object.entries(model)) {
      if (key.startsWith('$') || key.startsWith('xmlns') || !key.includes(':')) continue;
      const [prefix, localName] = key.split(':');
      if (!prefix || !localName || prefix !== model.$descriptor.ns?.prefix) continue;
      const uri = model.$descriptor.ns.uri;
      if (!Object.hasOwn(model, localName)) element.removeAttribute(localName);
      else element.setAttribute(localName, String(model[localName]));
      element.setAttributeNS(uri, key, String(value));
      if (element.lookupNamespaceURI(prefix) !== uri) element.setAttributeNS('http://www.w3.org/2000/xmlns/', `xmlns:${prefix}`, uri);
      changed = true;
    }
  }
  return changed ? serializeXml(document) : xml;
}

export function configureModdle(moddle: Moddle): Moddle {
  const toXML = moddle.toXML.bind(moddle);
  moddle.toXML = async (root, options) => {
    const result = await toXML(root, options);
    return { xml: repairGenericAttributes(root, result.xml) };
  };
  return moddle;
}
