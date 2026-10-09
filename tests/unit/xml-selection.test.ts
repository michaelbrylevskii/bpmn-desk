import { describe, expect, it } from 'vitest';
import { findXmlElement } from '../../src/renderer/ui/xml-selection';

describe('XML element navigation', () => {
  it('выделяет целый элемент с вложенными одноимёнными тегами, игнорирует comments/CDATA', () => {
    const inner = '<b:task id="task"><b:task id="child"/><![CDATA[<fake id="task"/>]]></b:task>';
    const source = `<b:process><!-- <fake id="task"/> -->${inner}<b:task id="other"/></b:process>`;
    const range = findXmlElement(source, 'task')!;
    expect(source.slice(range.from, range.to)).toBe(inner);
    expect(source.slice(range.opening.from, range.opening.to)).toBe('<b:task id="task">');
    expect(source.slice(range.closing!.from, range.closing!.to)).toBe('</b:task>');
  });
  it('поддерживает одинарные кавычки, entities и self-closing tags', () => {
    const source = "<root><node id='t&#97;sk'/><node id='other'/></root>";
    const range = findXmlElement(source, 'task')!;
    expect(source.slice(range.from, range.to)).toBe("<node id='t&#97;sk'/>");
    expect(range.closing).toBeUndefined();
  });
  it('не подсвечивает отсутствующий элемент или незавершённый тег', () => {
    expect(findXmlElement('<root/>', 'task')).toBeUndefined();
    expect(findXmlElement('<root><node id="task">', 'task')).toBeUndefined();
  });
});
