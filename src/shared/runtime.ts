/** Контракты чтения состояния движка. Секреты возвращаются только внутри main. */
export type RuntimeEngine = 'flowable' | 'camunda7';
export type Authentication = 'none' | 'basic' | 'bearer';
export const requestTimeoutSeconds = { default: 15, min: 5, max: 120 } as const;
export interface Connection {
  id: string; name: string; engine: RuntimeEngine; baseUrl: string; authentication: Authentication;
  username: string; hasSecret: boolean; secretStored: boolean;
  requestTimeoutSeconds?: number;
}
export interface ConnectionInput {
  id?: string; name: string; engine: RuntimeEngine; baseUrl: string; authentication: Authentication;
  username: string; secret?: string; rememberSecret: boolean;
  requestTimeoutSeconds?: number;
}
export interface Connections { items: Connection[]; secureStorage: boolean }
export interface PageQuery {
  start?: number; size?: number; search?: string; definitionId?: string; tenantId?: string;
  instanceId?: string; definitionKey?: string; executionId?: string; elementId?: string; suspended?: boolean;
  sort?: string; order?: 'asc' | 'desc'; latest?: boolean;
}
export interface RuntimePage<T> { data: T[]; total: number; start: number }
export interface Definition {
  id: string; key: string; name: string; version: number; deploymentId: string; tenantId: string; suspended: boolean; graphicalNotationDefined: boolean;
}
export interface Instance {
  id: string; name: string; businessKey: string; processDefinitionId: string; tenantId: string; suspended: boolean;
  startTime: string; superProcessInstanceId: string; processDefinitionName: string;
}
export interface Execution { id: string; parentId: string; activityId: string; processInstanceId: string; suspended: boolean }
export interface RuntimeTask { id: string; name: string; taskDefinitionKey: string; executionId: string; assignee: string; createTime: string }
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface Variable { name: string; type: string; scope: string; value: JsonValue; binary: boolean }
export interface DeadLetterJob {
  id: string; processInstanceId: string; processDefinitionId: string; executionId: string;
  elementId: string; elementName: string; exceptionMessage: string; retries: number; createTime: string; tenantId: string;
}
export interface InstanceSnapshot {
  instance: Instance; executions: Execution[]; activeIds: string[]; tasks: RuntimeTask[];
  variables: Variable[]; deadLetters: DeadLetterJob[]; children: Instance[]; warnings: string[]; capturedAt: string;
  unavailable: ('executions' | 'activeIds' | 'tasks' | 'variables' | 'deadLetters' | 'children')[];
}
export interface DeployedDiagram { definition: Definition; xml: string }
/** Ограниченная выборка, а не полный обход версии процесса. Ошибка отличается от пустого результата. */
export interface RuntimeSample<T> { data: T[]; total?: number; complete: boolean; error?: string }
export interface DefinitionSummary {
  executions: RuntimeSample<Execution>; deadLetters: RuntimeSample<DeadLetterJob>; capturedAt: string;
}
export interface RuntimeBridge {
  connections(): Promise<Connections>;
  saveConnection(input: ConnectionInput): Promise<Connection>;
  deleteConnection(id: string): Promise<void>;
  testConnection(id: string): Promise<void>;
  testConnectionDraft(input: ConnectionInput): Promise<void>;
  definitions(id: string, query: PageQuery): Promise<RuntimePage<Definition>>;
  instances(id: string, query: PageQuery): Promise<RuntimePage<Instance>>;
  deadLetters(id: string, query: PageQuery): Promise<RuntimePage<DeadLetterJob>>;
  diagram(id: string, definitionId: string): Promise<DeployedDiagram>;
  snapshot(id: string, instanceId: string): Promise<InstanceSnapshot>;
  summary(id: string, definitionId: string): Promise<DefinitionSummary>;
  executionVariables(id: string, executionId: string): Promise<Variable[]>;
  stacktrace(id: string, jobId: string): Promise<string>;
}
export const runtimeChannels = {
  connections: 'runtime:connections', save: 'runtime:save-connection', delete: 'runtime:delete-connection', test: 'runtime:test', testDraft: 'runtime:test-draft',
  definitions: 'runtime:definitions', instances: 'runtime:instances', deadLetters: 'runtime:dead-letters',
  diagram: 'runtime:diagram', snapshot: 'runtime:snapshot', summary: 'runtime:summary', executionVariables: 'runtime:execution-variables', stacktrace: 'runtime:stacktrace',
} as const;
