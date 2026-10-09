declare module 'bpmn-moddle' {
  import type { Moddle } from './types';
  export const BpmnModdle: new (extensions?: Record<string, unknown>) => Moddle;
}
