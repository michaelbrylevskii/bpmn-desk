export interface PropertyDescriptor {
  name: string;
  ns?: { name: string; prefix: string; localName: string };
  type: string;
  isAttr?: boolean;
  default?: unknown;
  isReference?: boolean;
  isMany?: boolean;
  isVirtual?: boolean;
}

export interface ModdleElement {
  $type: string;
  $parent?: ModdleElement;
  $attrs: Record<string, string>;
  $descriptor: { properties: PropertyDescriptor[]; isGeneric?: boolean; ns?: { prefix: string; localName: string; uri: string } };
  id?: string;
  name?: string;
  $instanceOf(type: string): boolean;
  get<T = unknown>(name: string): T;
  set(name: string, value: unknown): void;
  [property: string]: unknown;
}

export interface DiagramElement {
  id: string;
  type: string;
  businessObject: ModdleElement;
  di?: ModdleElement;
  labelTarget?: DiagramElement;
  parent?: DiagramElement;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ParseResult { rootElement: ModdleElement; warnings: { message: string }[] }
export interface Moddle {
  fromXML(xml: string): Promise<ParseResult>;
  toXML(element: ModdleElement, options?: { format?: boolean }): Promise<{ xml: string }>;
  create(type: string, attributes?: Record<string, unknown>): ModdleElement;
  createAny(name: string, uri: string, attributes?: Record<string, unknown>): ModdleElement;
}

export interface Diagnostic { severity: 'error' | 'warning'; message: string; elementId?: string; action?: 'arrange-boundaries' }
