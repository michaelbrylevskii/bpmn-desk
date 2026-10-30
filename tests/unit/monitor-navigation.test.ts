import { expect, it } from 'vitest';
import { navigateMonitor, type MonitorNavigation, type MonitorVisit } from '../../src/renderer/runtime/navigation-model';
const empty = (): MonitorNavigation => ({ past: [], future: [] });
const visit = (id: string): MonitorVisit => ({ definitionId: '', instanceId: id, history: false, destination: { kind: 'instance', id, name: `Process ${id}`, businessKey: `Order ${id}` } });
const open = (state: MonitorNavigation, id: string) => navigateMonitor(state, { type: 'open', visit: visit(id) });

it('сохраняет сведения назначения и проходит назад/вперёд в правильном порядке', () => {
  let state = open(open(open(empty(), 'a'), 'b'), 'c');
  state = navigateMonitor(state, { type: 'move', direction: 'back', leaving: { kind: 'instance', id: 'c', name: 'Resolved process', businessKey: 'ORDER:123' } });
  expect(state.current?.instanceId).toBe('b'); expect(state.future[0]?.destination).toMatchObject({ name: 'Resolved process', businessKey: 'ORDER:123' });
  state = navigateMonitor(state, { type: 'move', direction: 'back' }); expect(state.current?.instanceId).toBe('a');
  state = navigateMonitor(state, { type: 'move', direction: 'forward' }); expect(state.current?.instanceId).toBe('b');
  state = navigateMonitor(state, { type: 'move', direction: 'forward' }); expect(state.current?.instanceId).toBe('c'); expect(state.future).toEqual([]);
});
it('после возврата новый адрес удаляет будущую ветку', () => {
  const state = navigateMonitor(open(open(empty(), 'a'), 'b'), { type: 'move', direction: 'back' });
  const branched = open(state, 'c'); expect(branched.past.map(item => item.instanceId)).toEqual(['a']); expect(branched.future).toEqual([]);
});
it('режим подробностей и повторное открытие адреса не создают переходов', () => {
  const state = navigateMonitor(open(open(empty(), 'a'), 'b'), { type: 'move', direction: 'back' });
  const mode = navigateMonitor(state, { type: 'mode', history: true });
  expect(mode.past).toBe(state.past); expect(mode.future).toBe(state.future);
  expect(open(mode, 'a').past).toEqual([]); expect(open(mode, 'a').future).toHaveLength(1);
  expect(navigateMonitor(navigateMonitor(mode, { type: 'move', direction: 'forward' }), { type: 'move', direction: 'back' }).current?.history).toBe(true);
});
it('хранит до 100 переходов и ничего не меняет на границе', () => {
  let state = empty(); expect(navigateMonitor(state, { type: 'move', direction: 'back' })).toBe(state);
  for (let i = 0; i < 150; i++) state = open(state, String(i));
  expect(state.past).toHaveLength(100); expect(state.past[0]?.instanceId).toBe('49');
  expect(navigateMonitor(state, { type: 'move', direction: 'forward' })).toBe(state);
});
it('различает версии схем и jobs, история разных мониторов изолирована', () => {
  const first = open(empty(), 'a'); const second = open(empty(), 'b');
  const definition = { ...visit(''), definitionId: 'd1', destination: { kind: 'definition' as const, id: 'd1', name: 'Order', version: 1 } };
  const state = navigateMonitor(first, { type: 'open', visit: definition });
  expect(state.past[0]?.instanceId).toBe('a'); expect(second.current?.instanceId).toBe('b'); expect(second.past).toEqual([]);
  const job = { id: 'j1', processInstanceId: 'a', processDefinitionId: 'd1', executionId: '', elementId: 'Task', elementName: '', exceptionMessage: '', retries: 0, createTime: '', tenantId: '' };
  const one = navigateMonitor(first, { type: 'open', visit: { ...visit('a'), job } });
  const two = navigateMonitor(one, { type: 'open', visit: { ...visit('a'), job: { ...job, id: 'j2' } } });
  expect(two.past).toHaveLength(2); expect(navigateMonitor(two, { type: 'move', direction: 'back' }).current?.job?.id).toBe('j1');
});
