import type { HistoricInstance, HistoryQuery, HistorySnapshot } from '../../shared/history';
import type { RuntimePage, RuntimeSample } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { page } from './flowable-decode';
import { historicActivity, historicInstance, historicVariable } from './history-decode';
import type { RuntimeHttp } from './http';
import { identifier } from './validation';

const sorts = ['processInstanceId', 'processDefinitionId', 'businessKey', 'startTime', 'endTime', 'duration', 'tenantId'];
/** Только GET. Лимиты применяются до чтения следующей страницы, ошибки сохраняют прочитанную часть. */
export class HistoryReader {
  constructor(private readonly http: RuntimeHttp) {}
  async instances(query: HistoryQuery): Promise<RuntimePage<HistoricInstance>> {
    if (query.sort && !sorts.includes(query.sort)) throw new Error('Недопустимая сортировка API.');
    return page(await this.http.get('history/historic-process-instances', {
      start: query.start ?? 0, size: query.size ?? 25, sort: query.sort || 'startTime', order: query.order ?? 'desc',
      processInstanceId: query.instanceId, processDefinitionId: query.definitionId, processDefinitionKey: query.definitionKey,
      businessKey: query.search || undefined, tenantId: query.tenantId, finished: query.finished === undefined ? undefined : String(query.finished),
      startedAfter: query.startedAfter, startedBefore: query.startedBefore, finishedAfter: query.finishedAfter, finishedBefore: query.finishedBefore,
    }), historicInstance);
  }
  async snapshot(id: string): Promise<HistorySnapshot> {
    const instance = historicInstance(await this.http.get(`history/historic-process-instances/${encodeURIComponent(identifier(id))}`));
    const deadline = this.http.deadline();
    const [activities, children, variables] = await Promise.all([
      this.sample('history/historic-activity-instances', historicActivity, { processInstanceId: id }, 'activityInstanceId', 1000, deadline),
      this.sample('history/historic-process-instances', historicInstance, { superProcessInstanceId: id }, 'processInstanceId', 100, deadline),
      this.sample('history/historic-variable-instances', historicVariable, { processInstanceId: id }, 'variableName', 100, deadline),
    ]);
    return { instance, activities, children, variables, capturedAt: new Date().toISOString() };
  }
  private async sample<T>(path: string, decode: (value: unknown) => T, query: Record<string, string>, sort: string, limit: number, deadline: AbortSignal): Promise<RuntimeSample<T>> {
    const data: T[] = []; const ids = new Set<string>(); let total: number | undefined;
    try {
      do {
        const size = Math.min(100, limit - data.length);
        const result = page(await this.http.get(path, { ...query, sort, order: 'asc', start: data.length, size }, true, deadline), decode);
        total = result.total;
        if (result.start !== data.length || result.data.length > size || !result.data.length && data.length < total) throw new Error('Недопустимая пагинация API.');
        for (const item of result.data) {
          if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') {
            if (ids.has(item.id)) throw new Error('Недопустимая пагинация API.');
            ids.add(item.id);
          }
        }
        data.push(...result.data);
      } while (data.length < total && data.length < limit);
      return { data, total, complete: data.length >= total };
    } catch (error) { return { data, total, complete: false, error: errorMessage(error) }; }
  }
}
