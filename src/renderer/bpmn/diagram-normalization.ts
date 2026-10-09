import { BPMN_URI, elements, requireBpmn, serializeXml } from './xml';

const DI_URI = 'http://www.omg.org/spec/BPMN/20100524/DI';

/** Flowable Design иногда не пишет isExpanded. Наличие DI дочерних элементов
 * на той же плоскости означает развёрнутый подпроцесс. Явный флаг не меняем.
 */
export function normalizeDiagram(xml: string): string {
  const document = requireBpmn(xml);
  const subprocesses = new Map(elements(document).filter(element => element.namespaceURI === BPMN_URI && element.localName === 'subProcess')
    .map(element => [element.getAttribute('id'), element]));
  let changed = false;
  for (const plane of Array.from(document.getElementsByTagNameNS(DI_URI, 'BPMNPlane'))) {
    const shapes = Array.from(plane.getElementsByTagNameNS(DI_URI, 'BPMNShape'));
    const visible = new Set(shapes.map(shape => shape.getAttribute('bpmnElement')));
    for (const shape of shapes) {
      if (shape.hasAttribute('isExpanded')) continue;
      const subprocess = subprocesses.get(shape.getAttribute('bpmnElement'));
      if (!subprocess) continue;
      const hasChildren = elements(subprocess).some(child => child.namespaceURI === BPMN_URI && visible.has(child.getAttribute('id')));
      if (hasChildren) { shape.setAttribute('isExpanded', 'true'); changed = true; }
    }
  }
  return changed ? serializeXml(document) : xml;
}
