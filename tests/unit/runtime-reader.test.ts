import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { FlowableReader } from '../../src/desktop/runtime/flowable-reader';
import { RuntimeHttp } from '../../src/desktop/runtime/http';
import type { Connection } from '../../src/shared/runtime';

it('использует GET, дочитывает страницы executions и сохраняет частичный снимок при запрете jobs', async () => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(`${request.method} ${request.url}`);
    response.setHeader('content-type', 'application/json');
    const url = new URL(request.url!, 'http://localhost');
    if (url.pathname.endsWith('/process-instances/p1')) return response.end(JSON.stringify({ id: 'p1', processDefinitionId: 'process:1:d1' }));
    if (url.pathname.endsWith('/executions')) {
      const start = Number(url.searchParams.get('start'));
      return response.end(JSON.stringify({ start, total: 101, data: Array.from({ length: start ? 1 : 100 }, (_, i) => ({ id: `e${start + i}`, activityId: 'Task_A', processInstanceId: 'p1' })) }));
    }
    if (url.pathname.endsWith('/activities')) return response.end('["Task_A"]');
    if (url.pathname.endsWith('/variables')) return response.end('[{"name":"payload","type":"json","value":{"ok":true}}]');
    if (url.pathname.endsWith('/tasks')) return response.end('{"data":[],"total":0,"start":0}');
    response.statusCode = 403; response.end('{}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  const profile: Connection = { id: 'c', name: 'test', engine: 'flowable', baseUrl: `http://127.0.0.1:${address.port}/process-api/`, authentication: 'none', username: '', hasSecret: false, secretStored: false };
  try {
    const snapshot = await new FlowableReader(new RuntimeHttp(profile, '')).snapshot('p1');
    if (!snapshot) throw new Error('Нет снимка');
    expect(snapshot.executions).toHaveLength(101); expect(snapshot.activeIds).toEqual(['Task_A']);
    expect(snapshot.variables[0]?.value).toEqual({ ok: true }); expect(snapshot.warnings.join(' ')).toContain('403');
    expect(snapshot.unavailable).toContain('deadLetters'); expect(snapshot.unavailable).not.toContain('executions');
    expect(requests.every(request => request.startsWith('GET /process-api/'))).toBe(true);
    expect(requests.some(request => request.includes('start=100'))).toBe(true);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

it('поиск использует серверные критерии и разные имена параметров runtime и history', async () => {
  const requests: URL[] = [];
  const server = createServer((request, response) => {
    requests.push(new URL(request.url!, 'http://localhost'));
    response.setHeader('content-type', 'application/json'); response.end('{"data":[],"total":0,"start":0}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  const profile: Connection = { id: 'c', name: 'test', engine: 'flowable', baseUrl: `http://127.0.0.1:${address.port}/process-api/`, authentication: 'none', username: '', hasSecret: false, secretStored: false };
  try {
    const reader = new FlowableReader(new RuntimeHttp(profile, ''));
    await reader.definitions({ latest: true, definitionKey: 'order', search: 'Review' });
    await reader.instances({ businessKeyLike: 'ORDER:42', instanceName: 'Buyer', start: 25, size: 25 });
    await reader.historicInstances({ businessKeyLike: 'ORDER:42', instanceName: 'Buyer', finished: true });
    await reader.instances({ search: 'EXACT', instanceId: 'p1' });
    expect(Object.fromEntries(requests[0]!.searchParams)).toMatchObject({ latest: 'true', key: 'order', nameLike: '%Review%' });
    expect(Object.fromEntries(requests[1]!.searchParams)).toMatchObject({ businessKeyLikeIgnoreCase: '%ORDER:42%', nameLikeIgnoreCase: '%Buyer%', start: '25', size: '25' });
    expect(requests[1]!.searchParams.has('businessKey')).toBe(false);
    expect(Object.fromEntries(requests[2]!.searchParams)).toMatchObject({ businessKeyLikeIgnoreCase: '%ORDER:42%', processInstanceNameLikeIgnoreCase: '%Buyer%', finished: 'true' });
    expect(requests[2]!.searchParams.has('nameLikeIgnoreCase')).toBe(false);
    expect(Object.fromEntries(requests[3]!.searchParams)).toMatchObject({ businessKey: 'EXACT', id: 'p1' });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
