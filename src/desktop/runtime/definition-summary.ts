import type { DefinitionSummary, RuntimeSample } from '../../shared/runtime';
import { errorMessage } from '../../shared/errors';
import { RuntimeHttp } from './http';
import * as decode from './flowable-decode';
import { identifier } from './validation';

/** Ровно две страницы, без дочитывания, N+1 и переменных. Общий deadline включает чтение body. */
export async function readDefinitionSummary(http: RuntimeHttp, id: string, deadline = AbortSignal.timeout(8000)): Promise<DefinitionSummary> {
  const sample = async <T>(path: string, parse: (value: unknown) => T, sort: string): Promise<RuntimeSample<T>> => {
    try {
      const page = decode.page(await http.get(path, { processDefinitionId: identifier(id), start: 0, size: 100, sort, order: 'asc' }, true, deadline), parse);
      if (page.data.length > 100 || page.start !== 0) throw new Error('API не соблюдает ограничение выборки сводки.');
      return { data: page.data, total: page.total, complete: page.data.length >= page.total };
    } catch (error) { return { data: [], complete: false, error: errorMessage(error) }; }
  };
  const [executions, deadLetters] = await Promise.all([
    sample('runtime/executions', decode.execution, 'processInstanceId'),
    sample('management/deadletter-jobs', decode.deadLetter, 'id'),
  ]);
  return { executions, deadLetters, capturedAt: new Date().toISOString() };
}
