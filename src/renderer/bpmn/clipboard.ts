/** Общий буфер одного окна. bpmn-js хранит снимок выделения и клонирует его
 * при каждой вставке через command stack принимающего редактора. */
export class DiagramClipboard {
  private data: unknown;
  get(): unknown { return this.data; }
  set(data: unknown): void { this.data = data; }
  clear(): unknown { const previous = this.data; this.data = undefined; return previous; }
  isEmpty(): boolean { return !this.data; }
}
