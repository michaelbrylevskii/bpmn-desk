import { expect, it, vi } from 'vitest';
import { createServer, type RequestListener } from 'node:http';
import type { Connection, DefinitionSummary, Execution } from '../../src/shared/runtime';
import { RuntimeHttp } from '../../src/desktop/runtime/http';
import { readDefinitionSummary } from '../../src/desktop/runtime/definition-summary';
import { summaryBadges } from '../../src/renderer/bpmn/runtime-badges';

async function withApi(listener: RequestListener, run: (http: RuntimeHttp) => Promise<void>, timeout = 15) {
  const server = createServer(listener); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  const connection: Connection = { id: 'c', name: 'test', requestTimeoutSeconds: timeout, engine: 'flowable', baseUrl: `http://127.0.0.1:${address.port}/process-api/`, authentication: 'none', username: '', hasSecret: false, secretStored: false };
  try { await run(new RuntimeHttp(connection, '')); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}

it('ограничивает сводку тремя GET по конкретной версии без обхода страниц и экземпляров', async () => {
  const requests: URL[] = [];
  await withApi((request, response) => {
    expect(request.method).toBe('GET'); const url = new URL(request.url!, 'http://localhost'); requests.push(url);
    response.setHeader('content-type', 'application/json');
    const count = url.pathname.endsWith('/historic-activity-instances') ? 1000 : 100;
    response.end(JSON.stringify({ start: 0, total: 1000000, data: Array.from({ length: count }, (_, index) => ({ id: `e${index}`, activityId: 'Review', processDefinitionId: 'desk:2:d2', processInstanceId: `p${index % 10}` })) }));
  }, async http => {
    const summary = await readDefinitionSummary(http, 'desk:2:d2');
    expect(summary.executions.complete).toBe(false); expect(summary.executions.data).toHaveLength(100);
    expect(summary.activities.error).toBeUndefined(); expect(summary.activities.data).toHaveLength(1000); expect(summary.activities.complete).toBe(false);
    expect(requests).toHaveLength(3);
    expect(requests.map(url => url.pathname)).toEqual(['/process-api/runtime/executions', '/process-api/management/deadletter-jobs', '/process-api/history/historic-activity-instances']);
    for (const url of requests) {
      expect(url.searchParams.get('size')).toBe(url.pathname.endsWith('/historic-activity-instances') ? '1000' : '100'); expect(url.searchParams.get('start')).toBe('0'); expect(url.searchParams.get('processDefinitionId')).toBe('desk:2:d2');
    }
  });
});

it('отличает отказ доступа от отсутствия ошибок, сохраняя независимый результат executions', async () => {
  await withApi((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url!.includes('deadletter-jobs')) { response.statusCode = 403; response.end('{}'); }
    else response.end('{"start":0,"total":0,"data":[]}');
  }, async http => {
    const summary = await readDefinitionSummary(http, 'd1');
    expect(summary.executions.complete).toBe(true); expect(summary.deadLetters.complete).toBe(false);
    expect(summary.deadLetters.total).toBeUndefined(); expect(summary.deadLetters.error).toContain('403');
  });
});

for (const bodyStarted of [false, true]) it(`общий deadline останавливает медленный ${bodyStarted ? 'body' : 'ответ'} без дополнительных запросов`, async () => {
  let requests = 0;
  await withApi((request, response) => {
    requests++; response.setHeader('content-type', 'application/json');
    if (request.url!.includes('deadletter-jobs')) response.end('{"start":0,"total":0,"data":[]}');
    else if (bodyStarted) response.write('{"data":[');
  }, async http => {
    const summary = await readDefinitionSummary(http, 'd1', AbortSignal.timeout(100));
    expect(summary.executions.error).toBe('Превышено время ожидания API.'); expect(summary.deadLetters.complete).toBe(true); expect(requests).toBe(3);
  });
});

for (const { count, start, source } of [
  { count: 101, start: 0, source: 'executions' }, { count: 1001, start: 0, source: 'activities' }, { count: 1, start: 1, source: 'activities' },
] as const) it(`отклоняет страницу ${source}: ${count} записей с позиции ${start}`, async () => {
  await withApi((_request, response) => {
    response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ start, total: count, data: Array.from({ length: count }, (_, i) => ({ id: `e${i}`, processInstanceId: 'p1', processDefinitionId: 'd1' })) }));
  }, async http => { expect((await readDefinitionSummary(http, 'd1'))[source].error).toContain('ограничение'); });
});

const execution = (id: string, processInstanceId: string, activityId = 'Review'): Execution => ({ id, activityId, processInstanceId, parentId: '', suspended: false });
const summary = (): DefinitionSummary => ({ executions: { data: [execution('e1', 'p1'), execution('e2', 'p1'), execution('e3', 'p2')], total: 3, complete: true }, deadLetters: { data: [], total: 0, complete: true }, activities: { data: [], total: 0, complete: true }, capturedAt: '' });

it('не завышает число экземпляров из-за multi-instance и обозначает нижнюю границу при усечении', () => {
  const state = summary(); expect(summaryBadges(state)).toEqual([{ id: 'Review', failed: false, label: '● 2', sections: [{ kind: 'runtime', label: '● 2' }] }]);
  state.executions.complete = false; expect(summaryBadges(state)[0]?.label).toBe('● 2+');
  state.executions.data.push(execution('e4', '')); expect(summaryBadges(state)[0]?.label).toBe('● 2+');
});

it('считает разные экземпляры с ошибкой, использует известный execution и не выдумывает позицию', () => {
  const state = summary();
  const job = { id: 'j1', processInstanceId: 'p1', processDefinitionId: 'd1', executionId: 'e1', elementId: '', elementName: '', exceptionMessage: '', retries: 0, createTime: '', tenantId: '' };
  state.deadLetters.data = [job, { ...job, id: 'j2' }]; state.deadLetters.total = 2;
  expect(summaryBadges(state)[0]).toEqual({ id: 'Review', failed: true, label: '● 2 · ! 1', sections: [{ kind: 'runtime', label: '● 2' }, { kind: 'failed', label: '! 1' }] });
  state.deadLetters.data.push({ ...job, id: 'j3', executionId: 'unknown' });
  expect(summaryBadges(state)[0]?.label).toBe('● 2 · ! 1+'); expect(summaryBadges(state)).toHaveLength(1);
});

for (const timeout of [5, 120]) it(`сводка использует таймаут подключения ${timeout} с вместо фиксированных 8 с`, async () => {
  const spy = vi.spyOn(AbortSignal, 'timeout');
  try {
    await withApi((_request, response) => { response.setHeader('content-type', 'application/json'); response.end('{"start":0,"total":0,"data":[]}'); }, async http => {
      await readDefinitionSummary(http, 'd1');
      expect(spy.mock.calls[0]?.[0]).toBe(timeout * 1000);
      expect(spy.mock.calls.every(([value]) => value === timeout * 1000)).toBe(true);
    }, timeout);
  } finally { spy.mockRestore(); }
});
