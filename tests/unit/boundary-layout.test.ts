import { expect, it } from 'vitest';
import { BpmnModdle } from 'bpmn-moddle';
import type { DiagramElement, ModdleElement } from '../../src/renderer/bpmn/types';
import { boundaryLayoutIssues, planBoundaryLayout } from '../../src/renderer/bpmn/boundary-layout';

function fixture() {
  const moddle = new BpmnModdle();
  const host: DiagramElement = { id: 'call', type: 'bpmn:CallActivity', businessObject: moddle.create('bpmn:CallActivity', { id: 'call' }) as ModdleElement, x: 100, y: 100, width: 100, height: 80 };
  const events: DiagramElement[] = [0, 30].map(offset => ({ id: `event${offset}`, type: 'bpmn:BoundaryEvent', businessObject: moddle.create('bpmn:BoundaryEvent', { attachedToRef: host.businessObject }) as ModdleElement, x: 105 + offset, y: 165, width: 30, height: 30 }));
  return { host, events, items: [host, ...events] };
}
it('диагностика замечает перекрытый маркер, план освобождает маркер и разделяет события', () => {
  const { host, items } = fixture();
  expect(boundaryLayoutIssues(items)).toHaveLength(1);
  const moves = planBoundaryLayout(host, items);
  expect(moves).toHaveLength(2);
  const placed = items.map(element => {
    const move = moves.find(item => item.element === element);
    return move ? { ...element, x: element.x! + move.delta.x, y: element.y! + move.delta.y } : element;
  });
  expect(boundaryLayoutIssues(placed)).toEqual([]);
  expect(placed[1]!.y).toBe(165);
  expect(placed[2]!.y).toBe(165); // События остаются на исходной нижней стороне.
  expect(items[1]!.x).toBe(105); // План не изменяет входную модель.
});
it('при нехватке места план не меняет исходные координаты', () => {
  const { host, events, items } = fixture();
  host.width = 10; host.height = 10;
  expect(() => planBoundaryLayout(host, items)).toThrow('Недостаточно');
  expect(events[0]!.x).toBe(105);
});
