import { parser } from '@lezer/xml';
import { StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';
import { parseXml } from '../bpmn/xml';

export interface XmlRange {
  from: number; to: number;
  opening: { from: number; to: number };
  closing?: { from: number; to: number };
}

/** Синтаксическое дерево исключает ложные совпадения внутри comments/CDATA,
 * различает вложенные одноимённые теги и self-closing elements. */
export function findXmlElement(source: string, id: string): XmlRange | undefined {
  let result: XmlRange | undefined;
  parser.parse(source).iterate({ enter(ref) {
    if (result) return false;
    if (ref.name !== 'Element') return;
    const element = ref.node;
    const opening = element.getChild('OpenTag') ?? element.getChild('SelfClosingTag');
    if (!opening) return;
    const attribute = opening.getChildren('Attribute').find(attr => {
      const name = attr.getChild('AttributeName');
      return name && source.slice(name.from, name.to) === 'id';
    });
    const value = attribute?.getChild('AttributeValue');
    if (!value) return;
    const raw = source.slice(value.from, value.to);
    let decoded: string | null;
    try { decoded = raw.includes('&') ? parseXml(`<element id=${raw}/>`).documentElement.getAttribute('id') : raw.slice(1, -1); }
    catch { return; }
    if (decoded !== id) return;
    const closing = element.getChild('CloseTag');
    if (opening.name !== 'SelfClosingTag') {
      const startName = opening.getChild('TagName');
      const endName = closing?.getChild('TagName');
      if (!startName || !endName || source.slice(startName.from, startName.to) !== source.slice(endName.from, endName.to)) return;
    }
    result = { from: element.from, to: element.to, opening: { from: opening.from, to: opening.to },
      closing: closing ? { from: closing.from, to: closing.to } : undefined };
    return false;
  } });
  return result;
}

export const selectXmlElement = StateEffect.define<string | undefined>();
interface SelectionState { id?: string; range?: XmlRange; decorations: DecorationSet }
export const xmlSelection = StateField.define<SelectionState>({
  create: () => ({ decorations: Decoration.none }),
  update(previous, transaction) {
    const effect = transaction.effects.find(item => item.is(selectXmlElement));
    if (!transaction.docChanged && !effect) return previous;
    const id = effect ? effect.value : previous.id;
    const range = id ? findXmlElement(transaction.state.doc.toString(), id) : undefined;
    const marks = range ? [
      Decoration.mark({ class: 'xml-element-region' }).range(range.from, range.to),
      Decoration.mark({ class: 'xml-element-tag' }).range(range.opening.from, range.opening.to),
      ...(range.closing ? [Decoration.mark({ class: 'xml-element-tag' }).range(range.closing.from, range.closing.to)] : []),
    ] : [];
    return { id, range, decorations: Decoration.set(marks, true) };
  },
  provide: field => EditorView.decorations.from(field, value => value.decorations),
});
