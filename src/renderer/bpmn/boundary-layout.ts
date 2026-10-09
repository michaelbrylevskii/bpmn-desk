import type { DiagramElement, Diagnostic } from './types';
import type { Modeling } from './services';

interface Box { x: number; y: number; width: number; height: number }
interface Move { element: DiagramElement; delta: { x: number; y: number } }
interface LayoutContext { host: DiagramElement; moves: Move[]; modeling: Modeling }

function bounds(element: DiagramElement): Box | undefined {
  const { x, y, width, height } = element;
  return x === undefined || y === undefined || width === undefined || height === undefined ? undefined : { x, y, width, height };
}
function intersects(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}
function marker(host: DiagramElement, box: Box): Box | undefined {
  if (host.type !== 'bpmn:CallActivity' && (host.type !== 'bpmn:SubProcess' || host.di?.get('isExpanded') === true)) return;
  return { x: box.x + box.width / 2 - 8, y: box.y + box.height - 21, width: 16, height: 16 };
}
export function boundaryEvents(host: DiagramElement, items: DiagramElement[]): DiagramElement[] {
  return items.filter(item => item.type === 'bpmn:BoundaryEvent' && item.businessObject.get('attachedToRef') === host.businessObject);
}
export function boundaryLayoutIssues(items: DiagramElement[]): Diagnostic[] {
  return items.flatMap(host => {
    const box = bounds(host); if (!box) return [];
    const events = boundaryEvents(host, items).map(bounds).filter((item): item is Box => !!item);
    const activityMarker = marker(host, box);
    const overlap = events.some((event, index) => (activityMarker && intersects(event, activityMarker)) || events.slice(index + 1).some(other => intersects(event, other, 4)));
    return overlap ? [{ severity: 'warning' as const, elementId: host.id, action: 'arrange-boundaries' as const,
      message: 'Граничные события перекрывают друг друга или маркер подпроцесса. Можно изменить их размещение.' }] : [];
  });
}

/** Планируем все перемещения до команды: при нехватке места модель не меняется. */
export function planBoundaryLayout(host: DiagramElement, items: DiagramElement[]): Move[] {
  const box = bounds(host); if (!box) throw new Error('Не найдена геометрия элемента.');
  const events = boundaryEvents(host, items).sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0) || a.id.localeCompare(b.id));
  const size = Math.max(...events.map(item => Math.max(item.width ?? 36, item.height ?? 36)), 30);
  const inset = size / 2 + 4;
  const candidates: { x: number; y: number }[] = [];
  const slots = (length: number) => {
    const count = Math.floor((length - 2 * inset) / (size + 8)) + 1;
    return Array.from({ length: Math.max(0, count) }, (_, index) => count === 1 ? length / 2 : inset + index * (length - 2 * inset) / (count - 1));
  };
  for (const y of slots(box.height)) candidates.push({ x: box.x + box.width, y: box.y + y }, { x: box.x, y: box.y + y });
  for (const x of slots(box.width)) candidates.push({ x: box.x + x, y: box.y }, { x: box.x + x, y: box.y + box.height });
  const ancestors = new Set<DiagramElement>();
  for (let owner: DiagramElement | undefined = host; owner; owner = owner.parent) ancestors.add(owner);
  const occupied = items.filter(item => !ancestors.has(item) && !events.includes(item)).map(bounds).filter((item): item is Box => !!item);
  const activityMarker = marker(host, box); if (activityMarker) occupied.push(activityMarker);
  return events.map(element => {
    const original = bounds(element); if (!original) throw new Error('Не найдена геометрия граничного события.');
    const distance = (point: { x: number; y: number }) => (point.x - original.x - original.width / 2) ** 2 + (point.y - original.y - original.height / 2) ** 2;
    const center = candidates.filter(candidate => !occupied.some(other => intersects({ ...original, x: candidate.x - original.width / 2, y: candidate.y - original.height / 2 }, other, 4)))
      .sort((a, b) => distance(a) - distance(b))[0];
    if (!center) throw new Error('Недостаточно свободного места у элемента. Перемести граничные события вручную.');
    const next = { ...original, x: center.x - original.width / 2, y: center.y - original.height / 2 };
    occupied.push(next);
    return { element, delta: { x: next.x - original.x, y: next.y - original.y } };
  });
}

/** Вложенные стандартные команды обеспечивают перерисовку связей и один undo. */
export class BoundaryLayoutCommand {
  preExecute(context: LayoutContext): void {
    for (const move of context.moves) context.modeling.moveShape(move.element, move.delta);
  }
  execute(context: LayoutContext): DiagramElement[] { return [context.host]; }
  revert(context: LayoutContext): DiagramElement[] { return [context.host]; }
}
