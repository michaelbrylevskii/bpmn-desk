import Viewer from 'bpmn-js/lib/NavigatedViewer';
import { configureDiagramTheme, rendererColors } from './diagram-theme';
import { normalizeDiagram } from './diagram-normalization';
import { translationModule } from './translate';
import type { Language } from '../../shared/i18n';
import type { InstanceSnapshot } from '../../shared/runtime';
import type { Canvas, Registry } from './services';
import type { DiagramElement } from './types';
import { runtimeSvg, type RuntimeMark } from './runtime-export';

interface MarkedCanvas extends Canvas { addMarker(id: string, marker: string): void; removeMarker(id: string, marker: string): void; findRoot(element: DiagramElement): DiagramElement; setRootElement(element: DiagramElement): void }
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
  resize(): void { this.viewer.get<Canvas>('canvas').resized(); }
  focus(id: string): boolean {
    const element = this.viewer.get<Registry>('elementRegistry').get(id); if (!element) return false;
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); const root = canvas.findRoot(element);
    if (root) canvas.setRootElement(root); canvas.scrollToElement(element);
    this.viewer.get<{ select(element: DiagramElement): void }>('selection').select(element); return true;
  }
  state(snapshot: InstanceSnapshot | undefined): string[] {
    const canvas = this.viewer.get<MarkedCanvas>('canvas'); const registry = this.viewer.get<Registry>('elementRegistry');
    for (const { id, marker } of this.marked) if (registry.get(id)) canvas.removeMarker(id, marker);
    this.marked = []; this.marks = []; const overlays = this.viewer.get<Overlays>('overlays'); overlays.remove({ type: 'desk-runtime' });
    if (!snapshot) return [];
    const counts = new Map<string, number>(); const failed = new Map<string, number>();
    const parents = new Set(snapshot.executions.map(item => item.parentId).filter(Boolean));
    for (const execution of snapshot.executions) if (execution.activityId && !parents.has(execution.id)) counts.set(execution.activityId, (counts.get(execution.activityId) ?? 0) + 1);
    for (const job of snapshot.deadLetters) {
      const id = job.elementId || snapshot.executions.find(item => item.id === job.executionId)?.activityId;
      if (id) failed.set(id, (failed.get(id) ?? 0) + 1);
    }
    const missing: string[] = [];
    for (const id of new Set([...snapshot.activeIds, ...failed.keys()])) {
      if (!registry.get(id)) { missing.push(id); continue; }
      const marker = failed.has(id) ? 'runtime-failed' : 'runtime-active'; canvas.addMarker(id, marker); this.marked.push({ id, marker });
      const badge = document.createElement('span'); badge.className = `runtime-badge ${failed.has(id) ? 'failed' : ''}`;
      const label = failed.has(id) ? `! ${failed.get(id)}` : counts.has(id) ? String(counts.get(id)) : '';
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
