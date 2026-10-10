import Viewer from 'bpmn-js/lib/NavigatedViewer';
import { configureDiagramTheme, rendererColors } from './diagram-theme';
import { normalizeDiagram } from './diagram-normalization';
import { translationModule } from './translate';
import type { Language } from '../../shared/i18n';
import type { DefinitionSummary, InstanceSnapshot } from '../../shared/runtime';
import { instanceBadges, summaryBadges } from './runtime-badges';
import type { Canvas, Registry } from './services';
import type { DiagramElement } from './types';
import { runtimeSvg, type RuntimeMark } from './runtime-export';

interface Viewbox { x: number; y: number; width: number; height: number; outer: { width: number; height: number } }
interface MarkedCanvas extends Canvas { viewbox(box?: { x: number; y: number; width: number; height: number }): Viewbox; addMarker(id: string, marker: string): void; removeMarker(id: string, marker: string): void; findRoot(element: DiagramElement): DiagramElement; setRootElement(element: DiagramElement): void }
interface Overlays { add(id: string, type: string, options: { position: { bottom: number; right: number }; html: HTMLElement }): void; remove(options: { type: string }): void }
/** Состояние исполнения — только отображение; XML и команды моделирования не изменяются. */
export class RuntimeViewer {
  private readonly viewer: Viewer;
  private marked: { id: string; marker: string }[] = [];
  private marks: RuntimeMark[] = [];
  constructor(container: HTMLElement, language: () => Language, selected: (id: string) => void) {
    this.viewer = new Viewer({ container, bpmnRenderer: rendererColors, additionalModules: [translationModule(language)] });
    configureDiagramTheme(this.viewer.get('bpmnRenderer'));
    this.viewer.get<{ on(event: string, listener: (value: { newSelection: DiagramElement[] }) => void): void }>('eventBus').on('selection.changed', event => selected((event.newSelection[0]?.labelTarget ?? event.newSelection[0])?.id ?? ''));
  }
  async import(xml: string): Promise<void> {
    this.marked = []; await this.viewer.importXML(normalizeDiagram(xml)); this.fit();
  }
  fit(): void { this.viewer.get<Canvas>('canvas').zoom('fit-viewport', 'auto'); }
  async svg(): Promise<string> { const { svg } = await this.viewer.saveSVG(); return runtimeSvg(svg, this.marks); }
  resize(): void {
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); const previous = canvas.viewbox(); canvas.resized(); const next = canvas.viewbox();
    if (!previous.outer.width || !previous.outer.height || !next.outer.width || !next.outer.height) return;
    if (previous.outer.width === next.outer.width && previous.outer.height === next.outer.height) return;
    // Сохраняем центр и масштаб при изменении окна/панелей, а не оставляем схему за границей нового viewport.
    canvas.viewbox({ x: previous.x + (previous.width - next.width) / 2, y: previous.y + (previous.height - next.height) / 2, width: next.width, height: next.height });
  }
  focus(id: string): boolean {
    const element = this.viewer.get<Registry>('elementRegistry').get(id); if (!element) return false;
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); const root = canvas.findRoot(element);
    if (root) canvas.setRootElement(root); canvas.scrollToElement(element);
    this.viewer.get<{ select(element: DiagramElement): void }>('selection').select(element); return true;
  }
  state(snapshot: InstanceSnapshot | undefined, summary?: DefinitionSummary): string[] {
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); const registry = this.viewer.get<Registry>('elementRegistry');
    for (const { id, marker } of this.marked) if (registry.get(id)) canvas.removeMarker(id, marker);
    this.marked = []; this.marks = []; const overlays = this.viewer.get<Overlays>('overlays'); overlays.remove({ type: 'desk-runtime' });
    const badges = snapshot ? instanceBadges(snapshot) : summary ? summaryBadges(summary) : [];
    const missing: string[] = [];
    for (const { id, failed, label } of badges) {
      if (!registry.get(id)) { missing.push(id); continue; }
      const marker = failed ? 'runtime-failed' : 'runtime-active'; canvas.addMarker(id, marker); this.marked.push({ id, marker });
      const badge = document.createElement('span'); badge.className = `runtime-badge ${failed ? 'failed' : ''}`;
      if (label) badge.textContent = label; else { const dot = document.createElement('span'); dot.className = 'runtime-badge-dot'; badge.append(dot); }
      badge.dataset.activityId = id;
      const element = registry.get(id)!;
      if (element.x !== undefined && element.y !== undefined) this.marks.push({ id, marker, label, x: element.x + (element.width ?? 0) - 8, y: element.y + (element.height ?? 0) - 8 });
      overlays.add(id, 'desk-runtime', { position: { bottom: 8, right: 8 }, html: badge });
    }
    return missing;
  }
  destroy(): void { this.viewer.destroy(); }
}
