import type { MessageKey } from '../../shared/i18n';
import type { Namespace } from '../bpmn/namespaces';
import type { ModdleElement } from '../bpmn/types';

export type EngineId = 'flowable' | 'camunda7';
export type DocumentProfile = 'bpmn' | EngineId;
export interface EngineField {
  name: string;
  label?: MessageKey;
  type?: 'boolean';
  options?: readonly string[];
  defaultValue?: string;
}
export interface EngineProfile extends Namespace {
  id: EngineId;
  title: string;
  fieldsFor(element: ModdleElement): EngineField[];
}
