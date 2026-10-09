import { serializeXml } from './xml';

const XML_URI = 'http://www.w3.org/XML/1998/namespace';

/** Форматируем только отступы контейнеров. Текст, CDATA и mixed content не трогаем. */
export function formatXmlFragment(source: Element): string {
  const root = source.cloneNode(true) as Element;
  const format = (element: Element, depth: number): void => {
    const children = Array.from(element.childNodes);
    if (element.getAttributeNS(XML_URI, 'space') === 'preserve' ||
        children.some(node => node.nodeType === 4 || (node.nodeType === 3 && !!node.nodeValue?.trim())) ||
        !children.some(node => node.nodeType === 1)) return;
    for (const child of children) {
      if (child.nodeType === 3) { element.removeChild(child); continue; }
      if (child.nodeType === 1) format(child as Element, depth + 1);
      element.insertBefore(element.ownerDocument.createTextNode(`\n${'  '.repeat(depth + 1)}`), child);
    }
    element.appendChild(element.ownerDocument.createTextNode(`\n${'  '.repeat(depth)}`));
  };
  format(root, 0);
  return serializeXml(root);
}
