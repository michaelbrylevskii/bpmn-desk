import { afterEach, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { FlowableReader } from '../../src/desktop/runtime/flowable-reader';
import { RuntimeHttp } from '../../src/desktop/runtime/http';
import { historicActivity, historicInstance, historicVariable, historyQuery } from '../../src/desktop/runtime/history-decode';

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))); });
const process = { id: 'p:1', processDefinitionId: 'definition:1', startTime: '2026-10-01T12:00:00Z', endTime: '2026-10-01T12:10:00Z', durationInMillis: 600000 };
const activity = (index: number) => ({ id: `a${index}`, activityId: 'Review', activityName: 'Review document', activityType: 'userTask',
  processInstanceId: process.id, processDefinitionId: process.processDefinitionId, executionId: `e${index}`, startTime: process.startTime, endTime: null, durationInMillis: null });
function send(response: ServerResponse, data: unknown, status = 200) { response.statusCode = status; response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(data)); }
async function reader(handler: (url: URL, response: ServerResponse, request: IncomingMessage) => void) {
  const server = createServer((request, response) => handler(new URL(request.url!, 'http://localhost'), response, request)); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  return new FlowableReader(new RuntimeHttp({ id: 'c', name: 'test', engine: 'flowable', baseUrl: `http://127.0.0.1:${address.port}/process-api/`, authentication: 'none', username: '', hasSecret: false, secretStored: false }, ''));
}

it('фильтрует историю по определению, business key, периоду и завершению, используя только GET', async () => {
  let requested: URL | undefined;
  const api = await reader((url, response, request) => { expect(request.method).toBe('GET'); requested = url; send(response, { data: [process], total: 1, start: 0 }); });
  const result = await api.historicInstances(historyQuery({ search: 'ORDER + 123', definitionId: 'definition:1', tenantId: 'tenant', instanceId: 'p:1', finished: true, startedAfter: '2026-10-01T12:00:00+03:00', size: 10 }));
  expect(result.data[0]).toMatchObject({ ...process, deleteReason: '', durationInMillis: 600000 });
  expect(requested?.pathname).toBe('/process-api/history/historic-process-instances');
  expect(Object.fromEntries(requested!.searchParams)).toMatchObject({ businessKey: 'ORDER + 123', processDefinitionId: 'definition:1', processInstanceId: 'p:1', finished: 'true', startedAfter: '2026-10-01T09:00:00.000Z', sort: 'startTime', order: 'desc', size: '10' });
  await expect(api.historicInstances({ sort: 'id' })).rejects.toThrow('сортировка');
});

it('сохраняет повторные и параллельные выполнения, неизвестную длительность и частичную историю', async () => {
  const requests: string[] = [];
  const api = await reader((url, response, request) => {
    requests.push(`${request.method} ${url.pathname}`);
    if (url.pathname.endsWith('/p%3A1')) return send(response, process);
    if (url.pathname.endsWith('/historic-activity-instances')) {
      const start = Number(url.searchParams.get('start'));
      if (start) return send(response, {}, 503);
      return send(response, { data: Array.from({ length: 100 }, (_, i) => activity(i)), start, total: 101 });
    }
    if (url.pathname.endsWith('/historic-variable-instances')) return send(response, { data: [{ variable: { name: 'payload', type: 'binary', valueUrl: 'https://example.invalid/secret' } }], total: 1, start: 0 });
    send(response, {}, 403);
  });
  const result = await api.history(process.id);
  expect(result.activities.data).toHaveLength(100); expect(result.activities.complete).toBe(false); expect(result.activities.error).toContain('503');
  expect(result.activities.data[0]).toMatchObject({ activityId: 'Review', durationInMillis: null, endTime: '' });
  expect(result.children).toMatchObject({ data: [], complete: false }); expect(result.children.error).toContain('403');
  expect(result.variables).toMatchObject({ complete: true, data: [{ name: 'payload', value: null, binary: true }] });
  expect(requests).toHaveLength(5); expect(requests.every(item => item.startsWith('GET /process-api/history/'))).toBe(true);
});

it('ограничивает выборки до 1000 шагов, 100 дочерних экземпляров и 100 переменных', async () => {
  const api = await reader((url, response) => {
    if (url.pathname.endsWith('/p%3A1')) return send(response, process);
    const start = Number(url.searchParams.get('start'));
    const data = Array.from({ length: 100 }, (_, i) => url.pathname.endsWith('/historic-activity-instances') ? activity(start + i)
      : url.pathname.endsWith('/historic-process-instances') ? { ...process, id: `child${i}` } : { variable: { name: `v${i}`, value: i } });
    send(response, { data, start, total: 2000 });
  });
  const result = await api.history(process.id);
  expect(result.activities.data).toHaveLength(1000); expect(result.children.data).toHaveLength(100); expect(result.variables.data).toHaveLength(100);
  for (const section of [result.activities, result.children, result.variables]) { expect(section).toMatchObject({ total: 2000, complete: false }); expect(section.error).toBeUndefined(); }
});

it('не объявляет дубликаты страниц и нарушенную пагинацию полной историей', async () => {
  const api = await reader((url, response) => {
    if (url.pathname.endsWith('/p%3A1')) return send(response, process);
    if (url.pathname.endsWith('/historic-activity-instances')) return send(response, { data: [activity(0)], total: 2, start: Number(url.searchParams.get('start')) });
    send(response, { data: [], total: 0, start: 1 });
  });
  const result = await api.history(process.id);
  expect(result.activities).toMatchObject({ complete: false, data: [expect.objectContaining({ id: 'a0' })], error: 'Недопустимая пагинация API.' });
  expect(result.variables.complete).toBe(false);
});

it('проверяет даты, типы, отрицательную длительность и не подменяет null нулём', () => {
  expect(historicActivity(activity(0)).durationInMillis).toBeNull();
  expect(historicInstance({ ...process, durationInMillis: 0 }).durationInMillis).toBe(0);
  expect(() => historicActivity({ ...activity(0), durationInMillis: -1 })).toThrow();
  expect(() => historicActivity({ ...activity(0), startTime: 'garbage' })).toThrow();
  for (const input of [{ finished: 'true' }, { startedAfter: 'garbage' }, { startedAfter: '2026-11-01T00:00:00Z', startedBefore: '2026-10-01T00:00:00Z' }, { size: 1001 }]) expect(() => historyQuery(input)).toThrow();
});

it('сохраняет область task/execution для одноимённых исторических переменных', () => {
  const variable = { name: 'note', type: 'string', value: 'local' };
  expect(historicVariable({ processInstanceId: 'p', executionId: 'p', variable }).scope).toBe('global');
  expect(historicVariable({ processInstanceId: 'p', executionId: 'e', variable }).scope).toBe('execution:e');
  expect(historicVariable({ processInstanceId: 'p', taskId: 't', executionId: 'e', variable }).scope).toBe('task:t');
  expect(historicVariable({ variable }).scope).toBe('unknown');
});


it('читает метаданные родителя без полного снимка и ищет завершённого родителя в history только после 404', async () => {
  const requests: string[] = []; let status = 404;
  const api = await reader((url, response) => {
    requests.push(url.pathname);
    if (url.pathname.includes('/runtime/')) return send(response, {}, status);
    if (url.pathname.includes('/history/')) return send(response, process);
    send(response, { id: process.processDefinitionId, key: 'definition', name: 'Order processing', version: 1 });
  });
  expect(await api.instance(process.id)).toMatchObject({ id: process.id, processDefinitionName: 'Order processing' });
  expect(requests).toHaveLength(3);
  expect(requests.some(path => /activities|variables|executions/.test(path))).toBe(false);
  requests.length = 0; status = 403;
  await expect(api.instance(process.id)).rejects.toThrow('403');
  expect(requests).toHaveLength(1);
});

it('сохраняет метаданные связанного экземпляра после удаления deployment', async () => {
  const api = await reader((url, response) => send(response, url.pathname.includes('/runtime/') ? process : {}, url.pathname.includes('/runtime/') ? 200 : 404));
  expect(await api.instance(process.id)).toMatchObject({ id: process.id, processDefinitionId: process.processDefinitionId, processDefinitionName: '' });
});

it('отличает отсутствие экземпляра в runtime от отказа доступа', async () => {
  let status = 404;
  const api = await reader((_url, response) => send(response, {}, status));
  expect(await api.snapshot('finished')).toBeNull();
  status = 403; await expect(api.snapshot('private')).rejects.toThrow('403');
});
