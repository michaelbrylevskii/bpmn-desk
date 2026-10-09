import { isExtension } from '../bpmn/extensions';
import type { ModdleElement } from '../bpmn/types';
import { FLOWABLE_URI } from './descriptor';

export { extensionValues } from '../bpmn/extensions';
export const isFlowableExtension = (element: ModdleElement, name: string): boolean => isExtension(element, FLOWABLE_URI, name);
