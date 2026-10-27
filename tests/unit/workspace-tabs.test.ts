import { expect, it } from 'vitest';
import { closeWorkspace, moveWorkspace, openWorkspace, reconcileDocuments, type TabState } from '../../src/renderer/workspace/tab-state';
const state = (): TabState => ({ tabs: [{ kind: 'document', id: 'd1' }, { kind: 'home', id: 'h1' }, { kind: 'monitor', id: 'm1', connectionId: 'c1' }], activeId: 'h1' });
it('заменяет исходную стартовую вкладку документом или монитором, сохраняя порядок соседей', () => {
  for (const tab of [{ kind: 'document' as const, id: 'd2' }, { kind: 'monitor' as const, id: 'm2', connectionId: 'c2' }]) {
    const next = openWorkspace(state(), tab, 'h1'); expect(next.tabs.map(tab => tab.id)).toEqual(['d1', tab.id, 'm1']); expect(next.activeId).toBe(tab.id);
  }
});
it('активирует уже открытый документ без дубликата и удаляет только исходную пустую вкладку', () => {
  const next = openWorkspace(state(), { kind: 'document', id: 'd1' }, 'h1'); expect(next.tabs.map(tab => tab.id)).toEqual(['d1', 'm1']); expect(next.activeId).toBe('d1');
});
it('поздний ответ после закрытия стартовой вкладки не заменяет другую стартовую или монитор', () => {
  const current = openWorkspace(closeWorkspace(state(), 'h1'), { kind: 'home', id: 'h2' });
  expect(openWorkspace(current, { kind: 'document', id: 'd2' }, 'h1').tabs.map(tab => tab.id)).toEqual(['d1', 'm1', 'h2', 'd2']);
});
it('сверка документов не закрывает стартовые вкладки и сохраняет выбранный монитор', () => {
  const current = { ...state(), activeId: 'm1' }; const next = reconcileDocuments(current, ['d2']);
  expect(next.tabs.map(tab => tab.id)).toEqual(['h1', 'm1', 'd2']); expect(next.activeId).toBe('m1');
});
it('закрытие возвращает соседнюю вкладку, а закрытие последней оставляет начальную страницу', () => {
  expect(closeWorkspace(state(), 'h1').activeId).toBe('d1');
  expect(closeWorkspace({ tabs: [{ kind: 'home', id: 'h1' }], activeId: 'h1' }, 'h1')).toEqual({ tabs: [], activeId: '' });
});
it('переставляет документы, стартовые вкладки и мониторы, сохраняя активную вкладку', () => {
  const current = state();
  const next = moveWorkspace(current, 'd1', 'm1', true);
  expect(next.tabs.map(tab => tab.id)).toEqual(['h1', 'm1', 'd1']); expect(next.activeId).toBe('h1');
  const back = moveWorkspace(next, 'd1', 'h1', false);
  expect(back).toEqual(current);
  expect(moveWorkspace(current, 'm1', 'h1', false).tabs.map(tab => tab.id)).toEqual(['d1', 'm1', 'h1']);
  expect(closeWorkspace(next, 'd1').activeId).toBe('h1');
  expect(closeWorkspace({ ...next, activeId: 'd1' }, 'd1').activeId).toBe('m1');
  expect(moveWorkspace(current, 'd1', 'd1', true)).toBe(current);
  expect(moveWorkspace(current, 'missing', 'h1', true)).toBe(current);
  expect(moveWorkspace(current, 'd1', 'missing', true)).toBe(current);
  expect(current.tabs.map(tab => tab.id)).toEqual(['d1', 'h1', 'm1']);
});
