/** Геометрия в координатах схемы: одинакова для HTML и экспорта. */
export interface BadgeRect { x: number; y: number; width: number; height: number }
export interface BadgeOwner extends BadgeRect { id: string; plane: string; ancestors: string[] }
export interface BadgeObstacle extends BadgeRect { id: string; plane: string }
export interface BadgeRequest { owner: BadgeOwner; width: number }
export interface BadgeLeader { x1: number; y1: number; x2: number; y2: number }
export interface BadgePlacement extends BadgeRect { leader: BadgeLeader }
export const badgeHeight = 22;
const gap = 6;
export const intersectsBadge = (a: BadgeRect, b: BadgeRect, padding = 0): boolean =>
  a.x < b.x + b.width + padding && a.x + a.width + padding > b.x && a.y < b.y + b.height + padding && a.y + a.height + padding > b.y;
export function leaderIntersectsRect(line: BadgeLeader, rect: BadgeRect): boolean {
  let start = 0; let end = 1;
  const axes: [number, number, number, number][] = [[line.x1, line.x2 - line.x1, rect.x, rect.x + rect.width], [line.y1, line.y2 - line.y1, rect.y, rect.y + rect.height]];
  for (const [origin, delta, low, high] of axes) {
    if (delta === 0) { if (origin <= low || origin >= high) return false; continue; }
    const a = (low - origin) / delta; const b = (high - origin) / delta;
    start = Math.max(start, Math.min(a, b)); end = Math.min(end, Math.max(a, b));
    if (start >= end) return false;
  }
  return true;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const leader = (owner: BadgeRect, badge: BadgeRect): BadgeLeader => {
  const x1 = clamp(badge.x + badge.width / 2, owner.x, owner.x + owner.width);
  const y1 = clamp(badge.y + badge.height / 2, owner.y, owner.y + owner.height);
  return { x1, y1, x2: clamp(x1, badge.x, badge.x + badge.width), y2: clamp(y1, badge.y, badge.y + badge.height) };
};

/** Малые события получают ближайшие места первыми; порядок API не влияет на раскладку. */
export function layoutBadges(requests: BadgeRequest[], obstacles: BadgeObstacle[]): Map<string, BadgePlacement> {
  const result = new Map<string, BadgePlacement>(); const occupied: (BadgePlacement & { plane: string })[] = [];
  const ordered = [...requests].sort((a, b) => a.owner.width * a.owner.height - b.owner.width * b.owner.height || a.owner.y - b.owner.y || a.owner.x - b.owner.x || a.owner.id.localeCompare(b.owner.id));
  for (const { owner, width } of ordered) {
    const shapes = obstacles.filter(shape => shape.plane === owner.plane && !owner.ancestors.includes(shape.id));
    const badges = occupied.filter(badge => badge.plane === owner.plane);
    const right = owner.x + owner.width; const bottom = owner.y + owner.height;
    const candidates: BadgeRect[] = [];
    for (let ring = 0; ring < 12; ring++) {
      const distance = gap + ring * (badgeHeight + gap);
      const xs = [right - 8, owner.x + (owner.width - width) / 2, owner.x - width + 8];
      for (const x of xs) {
        candidates.push({ x, y: bottom + distance, width, height: badgeHeight });
        candidates.push({ x, y: owner.y - distance - badgeHeight, width, height: badgeHeight });
      }
      for (const y of [bottom - 8, owner.y + (owner.height - badgeHeight) / 2, owner.y - badgeHeight + 8]) {
        candidates.push({ x: right + distance, y, width, height: badgeHeight });
        candidates.push({ x: owner.x - distance - width, y, width, height: badgeHeight });
      }
    }
    // Ближайшее место предпочтительнее большого выноса ради сохранения одного угла.
    const cost = (rect: BadgeRect) => { const line = leader(owner, rect); return Math.hypot(line.x2 - line.x1, line.y2 - line.y1); };
    candidates.sort((a, b) => cost(a) - cost(b));
    const free = (rect: BadgeRect) => {
      const line = leader(owner, rect);
      return !shapes.some(shape => intersectsBadge(rect, shape, gap) || shape.id !== owner.id && leaderIntersectsRect(line, shape)) &&
        !badges.some(badge => intersectsBadge(rect, badge, gap) || leaderIntersectsRect(line, badge) || leaderIntersectsRect(badge.leader, rect));
    };
    const position = candidates.find(free) ?? { x: owner.x, y: Math.max(bottom, ...shapes.map(shape => shape.y + shape.height), ...badges.map(badge => badge.y + badge.height)) + gap, width, height: badgeHeight };
    const placement = { ...position, leader: leader(owner, position) };
    result.set(owner.id, placement); occupied.push({ ...placement, plane: owner.plane });
  }
  return result;
}
