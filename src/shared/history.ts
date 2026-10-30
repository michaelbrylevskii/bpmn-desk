import type { Instance, PageQuery, RuntimeSample, Variable } from './runtime';

/** История сохраняет отдельное выполнение элемента, а не только его BPMN ID. */
export interface HistoricInstance extends Instance {
  endTime: string; durationInMillis: number | null; deleteReason: string; startUserId: string;
}
export interface HistoricActivity {
  id: string; activityId: string; activityName: string; activityType: string;
  processInstanceId: string; processDefinitionId: string; executionId: string; taskId: string;
  calledProcessInstanceId: string; assignee: string; startTime: string; endTime: string; durationInMillis: number | null;
}
export interface HistoryQuery extends PageQuery {
  finished?: boolean; startedAfter?: string; startedBefore?: string; finishedAfter?: string; finishedBefore?: string;
}
export interface HistorySnapshot {
  instance: HistoricInstance; activities: RuntimeSample<HistoricActivity>;
  children: RuntimeSample<HistoricInstance>; variables: RuntimeSample<Variable>; capturedAt: string;
}
