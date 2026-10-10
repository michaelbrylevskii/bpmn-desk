import Viewer from 'bpmn-js/lib/NavigatedViewer';
import { configureDiagramTheme, rendererColors } from './diagram-theme';
import { normalizeDiagram } from './diagram-normalization';
import { translationModule } from './translate';
import type { Language } from '../../shared/i18n';
import type { InstanceSnapshot } from '../../shared/runtime';
import type { Canvas, Registry } from './services';
import type { DiagramElement } from './types';

interface MarkedCanvas extends Canvas { addMarker(id: string, marker: string): void; removeMarker(id: string, marker: string): void; findRoot(element: DiagramElement): DiagramElement; setRootElement(element: DiagramElement): void }
interface Overlays { add(id: string, type: string, options: { position: { bottom: number; right: number }; html: HTMLElement }): void; remove(options: { type: string }): void }
/** Состояние исполнения — только отображение; моделирование и экспорт не вызываются. */
export class RuntimeViewer {
  private readonly viewer: Viewer;
  private marked: { id: string; marker: string }[] = [];
  constructor(container: HTMLElement, language: () => Language, selected: (id: string) => void) {
    this.viewer = new Viewer({ container, bpmnRenderer: rendererColors, additionalModules: [translationModule(language)] });
    configureDiagramTheme(this.viewer.get('bpmnRenderer'));
    this.viewer.get<{ on(event: string, listener: (value: { element: DiagramElement }) => void): void }>('eventBus').on('element.click', event => selected((event.element.labelTarget ?? event.element).id));
  }
  async import(xml: string): Promise<void> {
    this.marked = []; await this.viewer.importXML(normalizeDiagram(xml)); this.fit();
  }
  fit(): void { this.viewer.get<Canvas>('canvas').zoom('fit-viewport', 'auto'); }
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
    this.marked = []; const overlays = this.viewer.get<Overlays>('overlays'); overlays.remove({ type: 'desk-runtime' });
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
      badge.textContent = failed.has(id) ? `! ${failed.get(id)}` : `${counts.get(id) ?? '●'}`;
      badge.dataset.activityId = id;
      overlays.add(id, 'desk-runtime', { position: { bottom: 8, right: 8 }, html: badge });
    }
    return missing;
  }
  destroy(): void { this.viewer.destroy(); }
}
