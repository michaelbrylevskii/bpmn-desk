import { BpmnModdle } from 'bpmn-moddle';
import type { Moddle, ModdleElement } from './types';
import { requireBpmn, preservationIssues, namespaceDeclarations, BPMN_URI } from './xml';
import { configureModdle } from './generic-xml';
import { formatXmlFragment } from './xml-fragment-format';

export const createModdle = (): Moddle => configureModdle(new BpmnModdle());

export async function checkImport(xml: string): Promise<{ xml: string; warnings: string[] }> {
  requireBpmn(xml);
  const moddle = createModdle();
  const result = await moddle.fromXML(xml);
  const output = await moddle.toXML(result.rootElement, { format: true });
  const issues = preservationIssues(xml, output.xml);
  return { xml: output.xml, warnings: [...result.warnings.map(w => w.message), ...issues] };
}

export async function parseExtensions(fragment: string, sourceXml: string): Promise<ModdleElement | undefined> {
  if (!fragment.trim()) return undefined;
  const xml = `<bpmn:definitions ${namespaceDeclarations(sourceXml)} targetNamespace="urn:bpmn-desk"><bpmn:process id="ExtensionHost">${fragment}</bpmn:process></bpmn:definitions>`;
  const document = requireBpmn(xml);
  const host = document.getElementsByTagNameNS(BPMN_URI, 'process')[0];
  const childElements = host ? Array.from(host.childNodes).filter(n => n.nodeType === 1) : [];
  if (childElements.length !== 1 || (childElements[0] as Element).localName !== 'extensionElements' ||
      (childElements[0] as Element).namespaceURI !== BPMN_URI) throw new Error('Ожидается один блок bpmn:extensionElements.');
  const parsed = await createModdle().fromXML(xml);
  if (parsed.warnings.length) throw new Error(parsed.warnings.map(w => w.message).join('; '));
  return parsed.rootElement.get<ModdleElement[]>('rootElements')[0]?.get<ModdleElement>('extensionElements');
}

export function extensionsXml(xml: string, id: string): string {
  const document = requireBpmn(xml);
  const element = Array.from(document.getElementsByTagName('*')).find(e => e.getAttribute('id') === id);
  const extension = element && Array.from(element.childNodes).find(n => n.nodeType === 1 && (n as Element).localName === 'extensionElements');
  return extension ? formatXmlFragment(extension as Element) : '<bpmn:extensionElements />';
}
