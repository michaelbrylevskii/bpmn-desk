import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeDiagram } from '../../src/renderer/bpmn/diagram-normalization';
import { preservationIssues, requireBpmn } from '../../src/renderer/bpmn/xml';

describe('Flowable DI', () => {
  it('разворачивает подпроцессы, дочерние элементы которых лежат на той же plane', () => {
    const source = readFileSync('examples/flowable-showcase.bpmn20.xml', 'utf8');
    const xml = normalizeDiagram(source);
    const shapes = Array.from(requireBpmn(xml).getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/DI', 'BPMNShape'));
    expect(shapes.find(shape => shape.getAttribute('bpmnElement') === 'approvalSubProcess')?.getAttribute('isExpanded')).toBe('true');
    expect(preservationIssues(source, xml)).toEqual([]);
    expect(normalizeDiagram(xml)).toBe(xml);
  });
});
