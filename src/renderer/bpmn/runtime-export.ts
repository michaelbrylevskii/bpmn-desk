import { elements, parseXml, serializeXml } from './xml';
import { standaloneSvg } from './diagram-theme';
export interface RuntimeMark { id: string; marker: 'runtime-active' | 'runtime-failed'; label: string; x: number; y: number }
/** HTML overlays переводятся в SVG; изображение не зависит от CSS приложения и viewport. */
export function runtimeSvg(source: string, marks: RuntimeMark[]): string {
  const document = parseXml(standaloneSvg(source)); const root = document.documentElement;
  const nodes = elements(document); const visible = new Set(nodes.map(element => element.getAttribute('data-element-id')));
  const exportedMarks = marks.filter(mark => visible.has(mark.id)); const byId = new Map(exportedMarks.map(mark => [mark.id, mark]));
  const badgeWidth = (label: string) => Math.max(22, label.length * 7 + 12);
  const create = (name: string, attributes: Record<string, string | number>) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value)); return node;
  };
  for (const element of nodes) {
    const classes = (element.getAttribute('class') ?? '').split(/\s+/);
    if (classes.includes('djs-outline') || classes.includes('djs-hit')) { element.parentNode?.removeChild(element); continue; }
    const mark = byId.get(element.getAttribute('data-element-id') ?? ''); if (!mark) continue;
    const visual = Array.from(element.childNodes).find(node => node.nodeType === 1 && (node as Element).getAttribute('class')?.split(/\s+/).includes('djs-visual'));
    const graphic = visual && Array.from(visual.childNodes).find(node => node.nodeType === 1) as Element | undefined;
    if (graphic) { graphic.setAttribute('stroke', mark.marker === 'runtime-failed' ? '#b4233a' : '#228d72'); graphic.setAttribute('stroke-width', '3'); }
  }
  for (const mark of exportedMarks) {
    const group = create('g', { 'data-runtime-badge': mark.id, transform: `translate(${mark.x},${mark.y})` });
    const width = badgeWidth(mark.label);
    group.appendChild(create('rect', { width, height: 22, rx: 6, fill: mark.marker === 'runtime-failed' ? '#b4233a' : '#228d72', stroke: '#fff', 'stroke-width': 1 }));
    if (mark.label) {
      const text = create('text', { x: width / 2, y: 11, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-family': 'sans-serif', 'font-size': 11, 'font-weight': 600 }); text.textContent = mark.label; group.appendChild(text);
    } else group.appendChild(create('circle', { cx: 11, cy: 11, r: 3, fill: '#fff' }));
    root.appendChild(group);
  }
  const box = root.getAttribute('viewBox')?.split(/[\s,]+/).map(Number);
  if (box?.length === 4 && box.every(Number.isFinite)) { const [x, y, width, height] = box as [number, number, number, number];
    const left = Math.min(x, ...exportedMarks.map(mark => mark.x)) - 24; const top = Math.min(y, ...exportedMarks.map(mark => mark.y)) - 24;
    const right = Math.max(x + width, ...exportedMarks.map(mark => mark.x + badgeWidth(mark.label))) + 24;
    const bottom = Math.max(y + height, ...exportedMarks.map(mark => mark.y + 22)) + 24;
    root.setAttribute('viewBox', `${left} ${top} ${right - left} ${bottom - top}`); root.setAttribute('width', String(right - left)); root.setAttribute('height', String(bottom - top)); }
  return serializeXml(document);
}
