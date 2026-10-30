import { badgeColors, sectionsWidth, sectionWidth, sectionZigzag } from './badge-sections';
import { layoutBadges, type BadgeOwner } from './badge-layout';
import Viewer from 'bpmn-js/lib/NavigatedViewer';
import OutlineModule from 'diagram-js/lib/features/outline';
import { configureDiagramTheme, rendererColors } from './diagram-theme';
import { normalizeDiagram } from './diagram-normalization';
import { translationModule } from './translate';
import type { Language } from '../../shared/i18n';
import type { DefinitionSummary, InstanceSnapshot } from '../../shared/runtime';
import type { Canvas, Registry } from './services';
import type { DiagramElement } from './types';
import { runtimeSvg, type RuntimeMark } from './runtime-export';
import type { HistorySnapshot } from '../../shared/history';
import { monitorMarks, type MonitorMark } from './monitor-marks';

interface Viewbox { x: number; y: number; width: number; height: number; outer: { width: number; height: number } }
interface MarkedCanvas extends Canvas { scroll(delta: { dx: number; dy: number }): void; viewbox(box?: { x: number; y: number; width: number; height: number }): Viewbox; addMarker(id: string, marker: string): void; removeMarker(id: string, marker: string): void; findRoot(element: DiagramElement): DiagramElement; setRootElement(element: DiagramElement): void }
interface Overlays { add(id: string, type: string, options: { position: { top: number; left: number }; html: HTMLElement }): string; remove(options: { type: string } | string): void }
/** Состояние исполнения — только отображение; XML и команды моделирования не изменяются. */
export class RuntimeViewer {
  private readonly viewer: Viewer;
  private rendered = new Map<string, { mark: MonitorMark; overlay?: string; html?: HTMLElement; exported: RuntimeMark }>();
  private marks: RuntimeMark[] = [];
  private fitPending = false;
  private programmaticSelection = false;
  constructor(private readonly container: HTMLElement, language: () => Language, selected: (id: string) => void) {
    this.viewer = new Viewer({ container, bpmnRenderer: rendererColors, additionalModules: [OutlineModule, translationModule(language)] });
    configureDiagramTheme(this.viewer.get('bpmnRenderer'));
    // В мониторе повторный прямой клик оставляет выбор и задаёт фильтр журнала.
    // Стандартный SelectionBehavior снимает выбор и путает это с фокусом из истории.
    this.viewer.get<{ on(event: string, priority: number, listener: (event: { element: DiagramElement; originalEvent: MouseEvent }) => false | undefined): void }>('eventBus').on('element.click', 1500, event => {
      if (event.originalEvent.button !== 0 || event.originalEvent.shiftKey || event.originalEvent.ctrlKey || event.originalEvent.metaKey) return;
      const element = event.element.labelTarget ?? event.element;
      const canvas = this.viewer.get<MarkedCanvas>('canvas');
      this.viewer.get<{ select(elements: DiagramElement[]): void }>('selection').select(element === canvas.getRootElement() ? [] : [element]);
      return false;
    });
    this.viewer.get<{ on(event: string, listener: (value: { newSelection: DiagramElement[] }) => void): void }>('eventBus').on('selection.changed', event => { if (!this.programmaticSelection) selected((event.newSelection[0]?.labelTarget ?? event.newSelection[0])?.id ?? ''); });
  }
  async import(xml: string): Promise<void> {
    this.rendered.clear(); this.marks = []; await this.viewer.importXML(normalizeDiagram(xml)); this.fit();
  }
  fit(): void {
    if (!this.container.clientWidth || !this.container.clientHeight) { this.fitPending = true; return; }
    this.fitPending = false;
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); canvas.zoom('fit-viewport', 'auto');
    const box = canvas.viewbox(); const margin = 40;
    if (box.outer.width <= margin * 2 || box.outer.height <= margin * 2) return;
    // BPMN bounds не включают HTML-бейджи: оставляем место у крайних событий и стрелок.
    const factor = Math.max(box.outer.width / (box.outer.width - margin * 2), box.outer.height / (box.outer.height - margin * 2));
    const registry = this.viewer.get<Registry>('elementRegistry');
    const badges = this.marks.filter(mark => { const element = registry.get(mark.id); return mark.badge !== false && element && canvas.findRoot(element) === canvas.getRootElement(); });
    const left = Math.min(box.x - box.width * (factor - 1) / 2, ...badges.map(mark => mark.x - 24));
    const top = Math.min(box.y - box.height * (factor - 1) / 2, ...badges.map(mark => mark.y - 24));
    const right = Math.max(box.x + box.width * (factor + 1) / 2, ...badges.map(mark => mark.x + (mark.sections?.length ? sectionsWidth(mark.sections) : sectionWidth(mark.label)) + 24));
    const bottom = Math.max(box.y + box.height * (factor + 1) / 2, ...badges.map(mark => mark.y + 22 + 24));
    canvas.viewbox({ x: left, y: top, width: right - left, height: bottom - top });
  }
  async svg(): Promise<string> { const { svg } = await this.viewer.saveSVG(); return runtimeSvg(svg, this.marks); }
  resize(): void {
    // canvas.resized запускает KeepSelectionVisible. В скрытом SVG getCTM возвращает единичную
    // матрицу, и автоматический scrollToElement способен потерять масштаб сохранённой вкладки.
    if (!this.container.clientWidth || !this.container.clientHeight) return;
    if (this.fitPending) { this.viewer.get<MarkedCanvas>('canvas').resized(); this.fit(); return; }
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); const previous = canvas.viewbox(); canvas.resized(); const next = canvas.viewbox();
    if (!previous.outer.width || !previous.outer.height || !next.outer.width || !next.outer.height) return;
    if (previous.outer.width === next.outer.width && previous.outer.height === next.outer.height) return;
    // Сохраняем центр и масштаб при изменении окна/панелей, а не оставляем схему за границей нового viewport.
    // viewbox округляет масштаб до 3 знаков. Сдвиг в пикселях сохраняет исходную матрицу без потери точности.
    canvas.scroll({ dx: (next.outer.width - previous.outer.width) / 2, dy: (next.outer.height - previous.outer.height) / 2 });
  }
  focus(id: string): boolean {
    const element = this.viewer.get<Registry>('elementRegistry').get(id); if (!element) return false;
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); const root = canvas.findRoot(element);
    this.programmaticSelection = true;
    try {
      if (root) canvas.setRootElement(root); canvas.scrollToElement(element);
      this.viewer.get<{ select(element: DiagramElement): void }>('selection').select(element);
    }
    finally { this.programmaticSelection = false; }
    return true;
  }
  state(snapshot: InstanceSnapshot | undefined, summary?: DefinitionSummary, history?: HistorySnapshot): string[] {
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); const registry = this.viewer.get<Registry>('elementRegistry');
    const overlays = this.viewer.get<Overlays>('overlays');
    const next = monitorMarks(snapshot, summary, history); const desired = new Map(next.map(mark => [mark.id, mark]));
    const geometry = (element: DiagramElement): BadgeOwner | undefined => {
      if (element.x === undefined || element.y === undefined || !element.width || !element.height) return;
      const ancestors: string[] = []; let parent = element.parent;
      while (parent) { ancestors.push(parent.id); parent = parent.parent; }
      return { id: element.id, x: element.x, y: element.y, width: element.width, height: element.height, ancestors, plane: ancestors.at(-1) ?? element.id };
    };
    const shapes = registry.getAll().flatMap(element => { const shape = geometry(element); return shape ? [shape] : []; });
    const placements = layoutBadges(next.flatMap(mark => {
      const owner = shapes.find(shape => shape.id === mark.id);
      return !mark.flow && owner ? [{ owner, width: mark.sections?.length ? sectionsWidth(mark.sections) : sectionWidth(mark.label) }] : [];
    }), shapes);
    for (const [id, rendered] of this.rendered) {
      const mark = desired.get(id);
      if (mark && mark.marker === rendered.mark.marker && mark.label === rendered.mark.label && mark.flow === rendered.mark.flow && JSON.stringify(mark.sections) === JSON.stringify(rendered.mark.sections)) continue;
      if (registry.get(id)) canvas.removeMarker(id, rendered.mark.marker);
      if (rendered.overlay) overlays.remove(rendered.overlay);
      this.rendered.delete(id);
    }
    const missing: string[] = [];
    for (const mark of next) {
      if (this.rendered.has(mark.id)) continue;
      const element = registry.get(mark.id);
      if (!element) { missing.push(mark.id); continue; }
      canvas.addMarker(mark.id, mark.marker);
      // Стрелки не получают HTML-бейджи; счётчики проходов доступны в журнале.
      if (mark.flow || element.x === undefined || element.y === undefined) {
        this.rendered.set(mark.id, { mark, exported: { id: mark.id, marker: mark.marker, label: '', x: 0, y: 0, badge: false } }); continue;
      }
      const badge = document.createElement('span');
      const style = { 'runtime-unfinished': 'unfinished', 'runtime-visited': 'visited', 'runtime-active': '', 'runtime-failed': 'failed' }[mark.marker];
      badge.className = `runtime-badge ${style}`; badge.dataset.activityId = mark.id;
      if (mark.sections?.length) {
        badge.classList.add('segmented'); badge.setAttribute('role', 'img'); badge.setAttribute('aria-label', mark.label);
        mark.sections.forEach((section, index) => {
          if (index) { const separator = document.createElement('span'); separator.hidden = true; separator.textContent = ' · '; badge.append(separator); }
          const part = document.createElement('span'); part.className = `runtime-badge-section ${section.kind}`; part.dataset.source = section.kind;
          part.setAttribute('aria-hidden', 'true'); part.textContent = section.label; part.style.backgroundColor = badgeColors[section.kind]; part.style.width = `${sectionWidth(section.label)}px`;
          if (index < mark.sections!.length - 1) part.style.clipPath = `polygon(0 0, ${sectionZigzag}, 0 100%)`;
          part.style.zIndex = String(mark.sections!.length - index); badge.append(part);
        });
      }
      else if (mark.label) badge.textContent = mark.label;
      else { const dot = document.createElement('span'); dot.className = 'runtime-badge-dot'; badge.append(dot); }
      const html = document.createElement('div'); html.className = 'runtime-badge-overlay';
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); line.setAttribute('aria-hidden', 'true');
      line.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'line')); html.append(line, badge);
      const overlay = overlays.add(mark.id, 'desk-runtime', { position: { top: 0, left: 0 }, html });
      this.rendered.set(mark.id, { mark, overlay, html, exported: { id: mark.id, marker: mark.marker, label: mark.label, sections: mark.sections, x: element.x, y: element.y } });
    }
    for (const [id, rendered] of this.rendered) {
      const position = placements.get(id); const element = registry.get(id);
      if (!position || !rendered.html || element?.x === undefined || element.y === undefined) continue;
      if (rendered.exported.x === position.x && rendered.exported.y === position.y && JSON.stringify(rendered.exported.leader) === JSON.stringify(position.leader)) continue;
      rendered.html.style.transform = `translate(${position.x - element.x}px, ${position.y - element.y}px)`;
      const line = rendered.html.querySelector('line')!;
      for (const [key, value] of Object.entries(position.leader)) line.setAttribute(key, String(value - (key.startsWith('x') ? position.x : position.y)));
      Object.assign(rendered.exported, { x: position.x, y: position.y, leader: position.leader });
    }
    this.marks = [...this.rendered.values()].map(item => item.exported);
    return missing;
  }
  clearSelection(): void {
    this.programmaticSelection = true;
    try { this.viewer.get<{ select(elements: DiagramElement[]): void }>('selection').select([]); }
    finally { this.programmaticSelection = false; }
  }
  destroy(): void { this.viewer.destroy(); }
}
