import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

/** Контролируемый read-only стенд для недоступной и неполной истории, не подмена реальных engine-тестов. */
export async function historyServer() {
  const xml = await readFile('tools/runtime-fixture/src/main/resources/processes/history.bpmn20.xml', 'utf8');
  const state = { holdDiagram: false, withoutDi: false, summaryHistoryCount: 0, summaryHistoryTotal: 0, summaryHistoryStatus: undefined as number | undefined, alternateDefinition: false, summaryStatus: 200, summaryCount: 1, summaryTotal: 1, summaryDelay: 0, summaryActive: 0, summaryMaxActive: 0, runtimeStatus: 404, finished: true, unfinishedActivities: false, related: false, metadataStatus: 200, diagramStatus: 200, activityStatus: 200, activityCount: 2, total: 2, delayFirst: 0, deliveredFirst: 0, requests: [] as URL[] };
  const diagrams: (() => void)[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const process = (id: string) => ({ id, name: '', processDefinitionName: id === 'p2' ? 'Review decisions' : 'Order fulfillment', superProcessInstanceId: state.related && id === 'p2' ? 'p1' : '', businessKey: id === 'p2' ? 'Other instance' : 'Historical order', processDefinitionId: 'd1', startTime: '2026-10-01T10:00:00Z', endTime: state.finished ? '2026-10-01T10:02:00Z' : '', durationInMillis: state.finished ? 120000 : null });
  const server = createServer((request, response) => {
    const url = new URL(request.url!, 'http://localhost'); state.requests.push(url);
    response.setHeader('content-type', 'application/json');
    const send = (data: unknown, status = 200) => { response.statusCode = status; response.end(JSON.stringify(data)); };
    const page = (data: unknown[], total = data.length) => send({ data, total, start: Number(url.searchParams.get('start')) });
    if (url.pathname.endsWith('/resourcedata')) {
      const respond = () => { response.setHeader('content-type', 'application/xml'); response.end(state.withoutDi ? xml.replace(/<bpmndi:BPMNDiagram[\s\S]*?<\/bpmndi:BPMNDiagram>/, '') : xml); };
      if (state.holdDiagram) diagrams.push(respond); else respond(); return;
    }
    const definition = { id: 'd1', key: 'deskHistory', version: 1, graphicalNotationDefined: !state.withoutDi };
    if (url.pathname.endsWith('/process-definitions/d1')) return send(definition, state.diagramStatus);
    if (url.pathname.endsWith('/process-definitions/d2')) return send({ ...definition, id: 'd2', key: 'deskHistory2', version: 2 }, state.diagramStatus);
    if (url.pathname.endsWith('/process-definitions')) return page(state.alternateDefinition ? [definition, { ...definition, id: 'd2', key: 'deskHistory2', version: 2 }] : [definition]);
    if (url.searchParams.has('processDefinitionId') && (url.pathname.endsWith('/runtime/executions') || url.pathname.endsWith('/management/deadletter-jobs') || url.pathname.endsWith('/historic-activity-instances'))) {
      state.summaryActive++; state.summaryMaxActive = Math.max(state.summaryMaxActive, state.summaryActive);
      const historical = url.pathname.endsWith('/historic-activity-instances');
      const status = historical ? state.summaryHistoryStatus ?? state.summaryStatus : state.summaryStatus; const count = url.searchParams.get('processDefinitionId') === 'd2' ? 3 : state.summaryCount; const total = state.summaryTotal;
      const respond = () => {
        state.summaryActive--;
        if (status !== 200) return send({}, status);
        if (url.pathname.endsWith('/management/deadletter-jobs')) return page([]);
        if (historical) return page(Array.from({ length: state.summaryHistoryCount }, (_, i) => ({ id: `ha${i}`, activityId: 'HistoryReview', activityType: 'userTask', processInstanceId: `p${i % 2}`, processDefinitionId: url.searchParams.get('processDefinitionId'), startTime: '2026-10-01T10:00:00Z', endTime: '2026-10-01T10:02:00Z' })), state.summaryHistoryTotal);
        page(Array.from({ length: count }, (_, i) => ({ id: `e${i}`, activityId: 'HistoryReview', processInstanceId: `p${i}` })), Math.max(count, total));
      };
      if (state.summaryDelay) { const timer = setTimeout(() => { timers.delete(timer); respond(); }, state.summaryDelay); timers.add(timer); } else respond();
      return;
    }
    if (/runtime\/process-instances\/p[12]$/.test(url.pathname)) return send(process(url.pathname.endsWith('/p2') ? 'p2' : 'p1'), state.runtimeStatus);
    if (url.pathname.endsWith('/runtime/process-instances')) return page(url.searchParams.has('superProcessInstanceId') ? state.related && url.searchParams.get('superProcessInstanceId') === 'p1' ? [process('p2')] : [] : [process('p1')]);
    if (url.pathname.endsWith('/runtime/executions')) return page([{ id: 'e1', processInstanceId: 'p1', activityId: 'HistoryReview' }]);
    if (url.pathname.endsWith('/activities')) return send(['HistoryReview']);
    if (url.pathname.endsWith('/runtime/tasks') || url.pathname.endsWith('/management/deadletter-jobs')) return page([]);
    if (url.pathname.endsWith('/variables')) return send([]);
    if (/historic-process-instances\/p[12]$/.test(url.pathname)) {
      const id = url.pathname.endsWith('/p2') ? 'p2' : 'p1';
      const status = state.metadataStatus;
      if (id === 'p1' && state.delayFirst) {
        const timer = setTimeout(() => { timers.delete(timer); state.deliveredFirst++; send(process(id), status); }, state.delayFirst); timers.add(timer); return;
      }
      return send(process(id), status);
    }
    if (url.pathname.endsWith('/historic-process-instances')) return page(url.searchParams.has('superProcessInstanceId') ? state.related && url.searchParams.get('superProcessInstanceId') === 'p1' ? [process('p2')] : [] : [process('p1'), process('p2')]);
    if (url.pathname.endsWith('/historic-variable-instances')) return page([]);
    if (url.pathname.endsWith('/historic-activity-instances')) {
      if (state.activityStatus !== 200) return send({}, state.activityStatus);
      const start = Number(url.searchParams.get('start')); const size = Number(url.searchParams.get('size'));
      return page(Array.from({ length: Math.min(size, Math.max(0, state.activityCount - start)) }, (_, i) => ({ id: `a${start + i}`, activityId: 'HistoryReview', activityName: 'Historical review', activityType: 'userTask', processInstanceId: url.searchParams.get('processInstanceId'), processDefinitionId: 'd1', executionId: `e${start + i}`, startTime: '2026-10-01T10:00:00Z', endTime: state.unfinishedActivities && start + i === state.activityCount - 1 ? '' : '2026-10-01T10:02:00Z', durationInMillis: 120000 })), state.total);
    }
    send({}, 404);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  return { state, releaseDiagram: () => { state.holdDiagram = false; for (const respond of diagrams.splice(0)) respond(); }, baseUrl: `http://127.0.0.1:${address.port}/process-api/`, stop: async () => { for (const timer of timers) clearTimeout(timer); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
