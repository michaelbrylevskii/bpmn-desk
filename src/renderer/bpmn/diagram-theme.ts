import type { DiagramElement, ModdleElement } from './types';
import { parseXml, elements, serializeXml } from './xml';

export const rendererColors = {
  defaultFillColor: 'var(--diagram-fill)', defaultStrokeColor: 'var(--diagram-stroke)', defaultLabelColor: 'var(--diagram-text)',
};
const exportColors: Record<string, string> = { '--diagram-fill': '#ffffff', '--diagram-stroke': '#263244', '--diagram-text': '#172138' };

interface Renderer { drawShape(parent: SVGElement, shape: DiagramElement): SVGElement }

/** Цвета DI имеют приоритет над палитрой приложения. Для явно заданной заливки
 * без цвета подписи выбираем контрастный текст только в отображении. */
export function configureDiagramTheme(renderer: Renderer): void {
  const draw = renderer.drawShape.bind(renderer);
  renderer.drawShape = (parent, shape) => {
    const graphic = draw(parent, shape);
    const di = (shape.labelTarget ?? shape).di;
    const fill = di?.get<string>('color:background-color') || di?.get<string>('bioc:fill');
    parent.style.removeProperty('--diagram-text');
    if (fill && !di?.get<ModdleElement>('label')?.get('color:color')) {
      const probe = document.createElement('span');
      probe.style.color = fill; probe.hidden = true; document.body.append(probe);
      const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      probe.remove();
      if (rgb?.length === 3) parent.style.setProperty('--diagram-text', (rgb[0]! * 0.299 + rgb[1]! * 0.587 + rgb[2]! * 0.114) > 150 ? '#172138' : '#f3f6fc');
    }
    return graphic;
  };
}

/** Экспорт самодостаточен: CSS variables приложения заменяются светлой палитрой,
 * явные цвета DI и локальный контраст подписи сохраняются. */
export function standaloneSvg(svg: string): string {
  const document = parseXml(svg.replace(/<!DOCTYPE svg PUBLIC[^>]*>/, ''));
  for (const element of elements(document)) {
    const variables = { ...exportColors };
    const ancestry: Element[] = [];
    for (let owner: Element | null = element; owner; owner = owner.parentNode?.nodeType === 1 ? owner.parentNode as Element : null) ancestry.unshift(owner);
    for (const owner of ancestry) {
      for (const match of (owner.getAttribute('style') ?? '').matchAll(/(--diagram-[\w-]+)\s*:\s*([^;]+)/g)) if (match[1] && match[2]) variables[match[1]] = match[2].trim();
    }
    for (const name of ['fill', 'stroke', 'color', 'style']) {
      if (element.hasAttribute(name)) element.setAttribute(name, element.getAttribute(name)!.replace(/var\((--diagram-[\w-]+)\)/g, (_whole, key: string) => variables[key] ?? exportColors['--diagram-text']!));
    }
  }
  return serializeXml(document);
}
