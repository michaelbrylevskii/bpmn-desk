import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { errorMessage } from '../../shared/errors';

export const BPMN_URI = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
const XMLNS_URI = 'http://www.w3.org/2000/xmlns/';
const XSI_URI = 'http://www.w3.org/2001/XMLSchema-instance';

export function parseXml(xml: string): Document {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('DTD и XML entities не поддерживаются.');
  const errors: string[] = [];
  let document;
  try {
    document = new DOMParser({ onError: (_level, message) => errors.push(message) }).parseFromString(xml, 'application/xml');
  } catch (error) { throw new Error(`Некорректный XML: ${errorMessage(error)}`); }
  if (errors.length || !document.documentElement) throw new Error(`Некорректный XML: ${errors.join('; ')}`);
  return document as unknown as Document;
}

export function requireBpmn(xml: string): Document {
  const document = parseXml(xml);
  if (document.documentElement.namespaceURI !== BPMN_URI || document.documentElement.localName !== 'definitions') {
    throw new Error('Ожидается BPMN 2.0 документ с корневым элементом definitions.');
  }
  return document;
}

export function serializeXml(node: Node): string {
  return new XMLSerializer().serializeToString(node as unknown as Parameters<XMLSerializer['serializeToString']>[0]);
}

export function elements(document: Document | Element): Element[] {
  return Array.from(document.getElementsByTagName('*'));
}

/** Сравниваем URI и localName: смена префикса/CDATA не меняет семантику. */
export function canonicalElement(element: Element): string {
  const attributes = Array.from(element.attributes)
    .filter(a => a.namespaceURI !== XMLNS_URI)
    .map(a => [`{${a.namespaceURI ?? ''}}${a.localName}`, a.value]).sort(([a], [b]) => (a ?? '').localeCompare(b ?? ''));
  const children: unknown[] = [];
  let text = '';
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === 1) {
      if (text.trim()) children.push(text);
      text = '';
      children.push(canonicalElement(child as Element));
    } else if (child.nodeType === 3 || child.nodeType === 4) text += child.nodeValue ?? '';
  }
  if (text.trim()) children.push(text);
  return JSON.stringify([element.namespaceURI, element.localName, attributes, children]);
}

export interface ProtectedData { owner: string; key: string; value: string }

export function protectedData(xml: string): ProtectedData[] {
  const document = requireBpmn(xml);
  const entries: ProtectedData[] = [];
  for (const element of elements(document)) {
    const owner = element.getAttribute('id') || (element === document.documentElement ? '@definitions' : '');
    if (!owner) continue;
    for (const attribute of Array.from(element.attributes)) {
      if (attribute.namespaceURI && ![BPMN_URI, XMLNS_URI, XSI_URI].includes(attribute.namespaceURI)) {
        entries.push({ owner, key: `attr:{${attribute.namespaceURI}}${attribute.localName}`, value: attribute.value });
      }
    }
    const extension = Array.from(element.childNodes).find(n => n.nodeType === 1 &&
      (n as Element).namespaceURI === BPMN_URI && (n as Element).localName === 'extensionElements');
    if (extension) entries.push({ owner, key: 'extensions', value: canonicalElement(extension as Element) });
  }
  return entries;
}

export function preservationIssues(before: string, after: string, allowed = new Set<string>(), aliases = new Map<string, string>()): string[] {
  const expected = protectedData(before);
  const actual = new Map(protectedData(after).map(entry => [`${entry.owner}|${entry.key}`, entry.value]));
  const owners = new Set(elements(requireBpmn(after)).map(element => element.getAttribute('id')));
  owners.add('@definitions');
  return expected.filter(entry => owners.has(aliases.get(entry.owner) ?? entry.owner) && !allowed.has(`${entry.owner}|${entry.key}`) &&
    actual.get(`${aliases.get(entry.owner) ?? entry.owner}|${entry.key}`) !== entry.value)
    .map(entry => `${entry.owner}: изменены или потеряны ${entry.key}`);
}

export function namespaceDeclarations(xml: string): string {
  const document = requireBpmn(xml);
  const namespaces = new Map<string, string>([['bpmn', BPMN_URI]]);
  for (const element of elements(document)) {
    for (const attr of Array.from(element.attributes)) {
      if (attr.namespaceURI === XMLNS_URI && attr.localName !== 'xmlns') namespaces.set(attr.localName, attr.value);
    }
  }
  return [...namespaces].map(([prefix, uri]) => `xmlns:${prefix}="${escapeAttribute(uri)}"`).join(' ');
}

export function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}
