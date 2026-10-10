import type { DeployedDiagram, InstanceSnapshot, PageQuery, RuntimePage, Variable } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { RuntimeHttp } from './http';
import * as decode from './flowable-decode';
import { identifier } from './validation';

const key = (value: string) => encodeURIComponent(identifier(value));
export class FlowableReader {
  constructor(private readonly http: RuntimeHttp) {}
  async test(): Promise<void> { await this.definitions({}); }
  definitions(query: PageQuery) {
    return this.paged('repository/process-definitions', decode.definition, { ...this.pagination(query, ['key', 'name', 'version', 'id', 'deploymentId', 'category'], 'key'), nameLike: query.search ? `%${query.search}%` : undefined, tenantId: query.tenantId, key: query.definitionKey });
  }
  instances(query: PageQuery) {
    return this.paged('runtime/process-instances', decode.instance, { ...this.pagination(query, ['id', 'processDefinitionId', 'processDefinitionKey', 'tenantId'], 'id'), processDefinitionId: query.definitionId, businessKey: query.search || undefined, tenantId: query.tenantId,
      id: query.instanceId, processDefinitionKey: query.definitionKey, suspended: query.suspended === undefined ? undefined : String(query.suspended) });
  }
  deadLetters(query: PageQuery) {
    return this.paged('management/deadletter-jobs', decode.deadLetter, { ...this.pagination(query, ['id', 'dueDate', 'executionId', 'processInstanceId', 'retries', 'tenantId'], 'id'), processDefinitionId: query.definitionId, processInstanceId: query.instanceId || query.search || undefined, tenantId: query.tenantId, executionId: query.executionId, elementId: query.elementId });
  }
  async diagram(id: string): Promise<DeployedDiagram> {
    const definition = decode.definition(await this.http.get(`repository/process-definitions/${key(id)}`));
    const xml = await this.http.get(`repository/process-definitions/${key(id)}/resourcedata`, {}, false);
    if (typeof xml !== 'string') throw new Error('API вернул некорректную схему.');
    return { definition, xml };
  }
  async snapshot(id: string): Promise<InstanceSnapshot> {
    const process = decode.instance(await this.http.get(`runtime/process-instances/${key(id)}`));
    const warnings: string[] = [];
    const optional = async <T>(name: string, action: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await action(); } catch (error) { warnings.push(`${name}: ${errorMessage(error)}`); return fallback; }
    };
    const params = { processInstanceId: id };
    const [executions, activeIds, tasks, variables, deadLetters, children] = await Promise.all([
      optional('Executions', () => this.all('runtime/executions', decode.execution, params, warnings), []),
      optional('Active activities', async () => decode.array(await this.http.get(`runtime/executions/${key(id)}/activities`), identifier), []),
      optional('Tasks', () => this.all('runtime/tasks', decode.task, params, warnings), []),
      optional('Variables', async () => decode.array(await this.http.get(`runtime/process-instances/${key(id)}/variables`), decode.variable), []),
      optional('Dead-letter jobs', () => this.all('management/deadletter-jobs', decode.deadLetter, params, warnings), []),
      optional('Child instances', () => this.all('runtime/process-instances', decode.instance, { superProcessInstanceId: id }, warnings), []),
    ]);
    return { instance: process, executions, activeIds: [...new Set([...activeIds, ...executions.map(item => item.activityId), ...tasks.map(item => item.taskDefinitionKey)].filter(Boolean))],
      tasks, variables, deadLetters, children, warnings, capturedAt: new Date().toISOString() };
  }
  async executionVariables(id: string): Promise<Variable[]> {
    return decode.array(await this.http.get(`runtime/executions/${key(id)}/variables`), decode.variable);
  }
  async stacktrace(id: string): Promise<string> {
    const value = await this.http.get(`management/deadletter-jobs/${key(id)}/exception-stacktrace`, {}, false);
    if (typeof value !== 'string') throw new Error('API вернул некорректный stacktrace.'); return value;
  }
  private async paged<T>(path: string, parse: (value: unknown) => T, query: Record<string, string | number | undefined>): Promise<RuntimePage<T>> {
    return decode.page(await this.http.get(path, { size: 25, start: 0, order: 'asc', ...query }), parse);
  }
  private pagination(query: PageQuery, allowed: string[], fallback: string): Record<string, string | number | undefined> {
    if (query.sort && !allowed.includes(query.sort)) throw new Error('Недопустимая сортировка API.');
    return { start: query.start ?? 0, size: query.size ?? 25, sort: query.sort || fallback, order: query.order ?? 'asc' };
  }
  private async all<T>(path: string, parse: (value: unknown) => T, query: Record<string, string>, warnings: string[]): Promise<T[]> {
    const items: T[] = []; let total = Infinity;
    while (items.length < total && items.length < 5000) {
      const result = decode.page(await this.http.get(path, { ...query, start: items.length, size: 100, sort: path === 'runtime/executions' ? 'processInstanceId' : 'id', order: 'asc' }), parse);
      total = result.total; if (!result.data.length) break; items.push(...result.data);
    }
    if (items.length < total) warnings.push(`${path}: показано ${items.length} из ${total}.`);
    return items;
  }
}
