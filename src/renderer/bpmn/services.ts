import type { DiagramElement, ModdleElement } from './types';

export interface Modeling {
  moveShape(element: DiagramElement, delta: { x: number; y: number }): void;
  updateProperties(element: DiagramElement, properties: Record<string, unknown>): void;
  updateModdleProperties(element: DiagramElement, target: ModdleElement, properties: Record<string, unknown>): void;
}
export interface Canvas {
  zoom(value?: number | 'fit-viewport', center?: 'auto'): number;
  resized(): void;
  scrollToElement(element: DiagramElement): void;
  getRootElement(): DiagramElement;
}
export interface Registry { getAll(): DiagramElement[]; get(id: string): DiagramElement | undefined }
export interface CommandStack {
  undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean;
  registerHandler(name: string, handler: new () => unknown): void;
  execute(name: string, context: unknown): void;
}
export interface Selection { get(): DiagramElement[]; select(element: DiagramElement | DiagramElement[]): void }
export interface EventBus { fire(event: string): void; on(event: string, listener: () => void): void }
