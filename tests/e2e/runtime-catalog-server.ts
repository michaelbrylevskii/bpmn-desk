import { createServer } from 'node:http';

/** Независимый read-only API: задержка body имитирует медленный серверный count. */
export async function catalogServer(delay = 0) {
  const state = { delay, requests: [] as URL[], closed: 0 };
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    const url = new URL(request.url!, 'http://localhost');
    if (url.pathname.endsWith('/process-instances')) {
      state.requests.push(url); response.write('{');
      const data = url.searchParams.has('businessKey') ? [] : [{ id: 'p1', processDefinitionId: 'd1', businessKey: 'Example order' }];
      const timer = setTimeout(() => response.end(JSON.stringify({ data, start: 0, total: data.length }).slice(1)), state.delay);
      response.on('close', () => { state.closed++; clearTimeout(timer); }); return;
    }
    response.end('{"data":[{"id":"d1","key":"example","name":"Example process","version":1}],"start":0,"total":1}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  const stop = async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); };
  return { state, stop, baseUrl: `http://127.0.0.1:${address.port}/process-api/` };
}
