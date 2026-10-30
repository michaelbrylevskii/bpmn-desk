import { expect, it } from 'vitest';
import { intersectsBadge, layoutBadges, leaderIntersectsRect, type BadgeOwner } from '../../src/renderer/bpmn/badge-layout';

const owner = (id: string, x: number, y: number, width = 36, height = 36, plane = 'process'): BadgeOwner => ({ id, x, y, width, height, plane, ancestors: [plane] });
it('разводит длинные бейджи задачи и двух соседних boundary events, сохраняя привязку', () => {
  const nodes = [owner('Task', 200, 100, 130, 80), owner('A', 210, 162), owner('B', 246, 162)];
  const obstacles = [...nodes, owner('Label', 190, 202, 150, 25)];
  const requests = nodes.map(node => ({ owner: node, width: 150 }));
  const layout = layoutBadges(requests, obstacles);
  for (const node of nodes) {
    const badge = layout.get(node.id)!;
    for (const shape of obstacles) expect(intersectsBadge(badge, shape, 5)).toBe(false);
    for (const [id, other] of layout) if (id !== node.id) {
      expect(intersectsBadge(badge, other, 5)).toBe(false); expect(leaderIntersectsRect(badge.leader, other)).toBe(false);
    }
    expect(badge.leader.x1).toBeGreaterThanOrEqual(node.x); expect(badge.leader.x1).toBeLessThanOrEqual(node.x + node.width);
    expect(badge.leader.y1).toBeGreaterThanOrEqual(node.y); expect(badge.leader.y1).toBeLessThanOrEqual(node.y + node.height);
  }
  expect(layoutBadges([...requests].reverse(), obstacles)).toEqual(layout);
});
it('учитывает ширину обновлённых счётчиков, допускает размещение внутри контейнера и разделяет плоскости', () => {
  const a = owner('A', 100, 100); a.ancestors.unshift('Container');
  const b = owner('B', 100, 100, 36, 36, 'other');
  const layout = layoutBadges([{ owner: a, width: 220 }, { owner: b, width: 220 }], [a, b, owner('Container', 0, 0, 600, 400)]);
  expect(layout.get('A')).toEqual(layout.get('B'));
  expect(layout.get('A')!.width).toBe(220);
});
it('в полностью занятом окружении выносит бейдж за препятствия, не накладывая его на соседей', () => {
  const a = owner('A', 0, 0);
  const obstacle = owner('Busy', -1000, -1000, 2000, 2000);
  const layout = layoutBadges([{ owner: a, width: 220 }], [a, obstacle]);
  expect(intersectsBadge(layout.get('A')!, obstacle, 5)).toBe(false);
});
