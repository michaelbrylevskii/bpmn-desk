import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

/** Контролируемый read-only стенд для недоступной и неполной истории, не подмена реальных engine-тестов. */
export async function historyServer() {
  const xml = await readFile('tools/runtime-fixture/src/main/resources/processes/history.bpmn20.xml', 'utf8');
  const state = { metadataStatus: 200, diagramStatus: 200, activityStatus: 200, activityCount: 2, total: 2, delayFirst: 0, deliveredFirst: 0, requests: [] as URL[] };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const process = (id: string) => ({ id, businessKey: id === 'p2' ? 'Other instance' : 'Historical order', processDefinitionId: 'd1', startTime: '2026-10-01T10:00:00Z', endTime: '2026-10-01T10:02:00Z', durationInMillis: 120000 });
  const server = createServer((request, response) => {
    const url = new URL(request.url!, 'http://localhost'); state.requests.push(url);
    response.setHeader('content-type', 'application/json');
    const send = (data: unknown, status = 200) => { response.statusCode = status; response.end(JSON.stringify(data)); };
    const page = (data: unknown[], total = data.length) => send({ data, total, start: Number(url.searchParams.get('start')) });
    if (url.pathname.endsWith('/resourcedata')) { response.setHeader('content-type', 'application/xml'); response.end(xml); return; }
    const definition = { id: 'd1', key: 'deskHistory', version: 1, graphicalNotationDefined: true };
    if (url.pathname.endsWith('/process-definitions/d1')) return send(definition, state.diagramStatus);
    if (url.pathname.endsWith('/process-definitions')) return page([definition]);
    if (/historic-process-instances\/p[12]$/.test(url.pathname)) {
      const id = url.pathname.endsWith('/p2') ? 'p2' : 'p1';
      const status = state.metadataStatus;
      if (id === 'p1' && state.delayFirst) {
        const timer = setTimeout(() => { timers.delete(timer); state.deliveredFirst++; send(process(id), status); }, state.delayFirst); timers.add(timer); return;
      }
      return send(process(id), status);
    }
    if (url.pathname.endsWith('/historic-process-instances')) return page(url.searchParams.has('superProcessInstanceId') ? [] : [process('p1'), process('p2')]);
    if (url.pathname.endsWith('/historic-variable-instances')) return page([]);
    if (url.pathname.endsWith('/historic-activity-instances')) {
      if (state.activityStatus !== 200) return send({}, state.activityStatus);
      const start = Number(url.searchParams.get('start')); const size = Number(url.searchParams.get('size'));
      return page(Array.from({ length: Math.min(size, Math.max(0, state.activityCount - start)) }, (_, i) => ({ id: `a${start + i}`, activityId: 'HistoryReview', activityName: 'Historical review', activityType: 'userTask', processInstanceId: url.searchParams.get('processInstanceId'), processDefinitionId: 'd1', executionId: `e${start + i}`, startTime: '2026-10-01T10:00:00Z', endTime: '2026-10-01T10:02:00Z', durationInMillis: 120000 })), state.total);
    }
    send({}, 404);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  return { state, baseUrl: `http://127.0.0.1:${address.port}/process-api/`, stop: async () => { for (const timer of timers) clearTimeout(timer); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
