import { badgeColors, badgeLabel, sectionsWidth, sectionWidth, type BadgeSection } from './badge-sections';

/** Та же геометрия секций, что у HTML: перекрытие 3px, шесть отрезков зигзага и общий радиус 6px. */
export function appendBadgeSvg(document: Document, group: Element, sections: BadgeSection[], clipId: string): void {
  const create = (name: string, attributes: Record<string, string | number>) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value)); return element;
  };
  const width = sectionsWidth(sections);
  const title = create('title', {}); title.textContent = badgeLabel(sections); group.appendChild(title);
  const defs = create('defs', {}); const clip = create('clipPath', { id: clipId });
  clip.appendChild(create('rect', { width, height: 22, rx: 6 })); defs.appendChild(clip); group.appendChild(defs);
  const content = create('g', { 'clip-path': `url(#${clipId})` }); group.appendChild(content);
  let offset = 0;
  const layouts = sections.map((section, index) => { const x = offset; const size = sectionWidth(section.label); offset += size - 3; return { section, index, x, size }; });
  // Левая секция лежит поверх правой: зубцы вырезают её цвет, открывая следующий.
  for (const { section, index, x, size } of layouts.reverse()) {
    const part = create('g', { 'data-badge-source': section.kind }); const right = x + size;
    if (index === sections.length - 1) part.appendChild(create('rect', { x, width: size, height: 22, fill: badgeColors[section.kind] }));
    else {
      const teeth = Array.from({ length: 7 }, (_, step) => `${right - (step % 2 ? 3 : 0)},${22 * step / 6}`).join(' ');
      part.appendChild(create('polygon', { points: `${x},0 ${teeth} ${x},22`, fill: badgeColors[section.kind] }));
    }
    const text = create('text', { x: x + size / 2 + (index ? 1.5 : 0), y: 11, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-family': 'sans-serif', 'font-size': 11, 'font-weight': 650 });
    text.textContent = section.label; part.appendChild(text); content.appendChild(part);
  }
  group.appendChild(create('rect', { width, height: 22, rx: 6, fill: 'none', stroke: '#fff', 'stroke-width': 1 }));
}
