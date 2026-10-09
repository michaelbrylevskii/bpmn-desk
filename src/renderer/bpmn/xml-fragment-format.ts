import { serializeXml } from './xml';

const XML_URI = 'http://www.w3.org/XML/1998/namespace';
const whitespace = (text: string | null) => /^[\t\n\r ]*$/.test(text ?? '');

function inheritsPreservedSpace(element: Element): boolean {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const space = ancestor.getAttributeNS(XML_URI, 'space');
    if (space) return space === 'preserve';
  }
  return false;
}

/** Форматируем только отступы контейнеров. Текст, CDATA и mixed content не трогаем. */
export function formatXmlFragment(source: Element): string {
  const root = source.cloneNode(true) as Element;
  const format = (element: Element, depth: number): void => {
    const children = Array.from(element.childNodes);
    if (element.getAttributeNS(XML_URI, 'space') === 'preserve' ||
        children.some(node => node.nodeType === 4 || (node.nodeType === 3 && !whitespace(node.nodeValue))) ||
        !children.some(node => node.nodeType === 1)) return;
    for (const child of children) {
      if (child.nodeType === 3) { element.removeChild(child); continue; }
      if (child.nodeType === 1) format(child as Element, depth + 1);
      element.insertBefore(element.ownerDocument.createTextNode(`\n${'  '.repeat(depth + 1)}`), child);
    }
    element.appendChild(element.ownerDocument.createTextNode(`\n${'  '.repeat(depth)}`));
  };
  if (root.getAttributeNS(XML_URI, 'space') === 'default' || !inheritsPreservedSpace(source)) format(root, 0);
  return serializeXml(root);
}
