import { namespacedKey, namespacedValue } from '../bpmn/namespaces';
import type { ModdleElement } from '../bpmn/types';
import { FLOWABLE_URI } from './descriptor';

export const flowableNamespace = { uri: FLOWABLE_URI, prefix: 'flowable' };
export const attributeKey = (element: ModdleElement, name: string): string => namespacedKey(element, name, flowableNamespace);
export const flowableValue = (element: ModdleElement, name: string): string => namespacedValue(element, name, flowableNamespace);
