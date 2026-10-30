import { describe, expect, it } from 'vitest';
import { catalogConditions, cleanCatalogQuery, defaultCatalogQuery, removeCatalogCondition } from '../../src/renderer/runtime/catalog-query';

describe('условия каталога', () => {
  it('различает отсутствие условия и false для статусов, отключает latest явно', () => {
    expect(catalogConditions('definitions', defaultCatalogQuery('definitions')).map(item => item.key)).toEqual(['latest']);
    const all = removeCatalogCondition(defaultCatalogQuery('definitions'), 'latest');
    expect(all.latest).toBe(false); expect(catalogConditions('definitions', all)).toEqual([]);
    expect(catalogConditions('runtime', { suspended: false })).toEqual([{ key: 'suspended', label: 'Активен' }]);
    expect(catalogConditions('history', { finished: false })).toEqual([{ key: 'finished', label: 'Не окончен по данным истории' }]);
  });
  it('удаление предфильтра не затрагивает остальные условия и возвращает первую страницу', () => {
    const query = { definitionId: 'definition:2', businessKeyLike: 'order', startedAfter: '2026-10-01T00:00:00Z', start: 50, size: 25 };
    expect(removeCatalogCondition(query, 'definitionId')).toEqual({ ...query, definitionId: undefined, start: 0 });
    expect(query.start).toBe(50); expect(query.definitionId).toBe('definition:2');
  });
  it('несколько текстовых полей применяются вместе, пробелы и пустые поля не становятся фильтрами', () => {
    const query = cleanCatalogQuery({ search: ' order:123 ', instanceName: ' Review ', definitionId: ' ', finished: false, start: 50, size: 10 });
    expect(query).toEqual({ search: 'order:123', instanceName: 'Review', definitionId: undefined, finished: false, start: 0, size: 10 });
    expect(catalogConditions('history', query).map(item => item.key)).toEqual(['search', 'instanceName', 'finished']);
  });
});

it('смена общего контекста сбрасывает страницы трёх источников, сохраняя локальные условия и каталог определений', async () => {
  const { resetContextPages } = await import('../../src/renderer/runtime/catalog-query');
  const queries = { runtime: { start: 50, definitionId: 'old', search: 'order' }, history: { start: 100, finished: false }, jobs: { start: 25, executionId: 'e' }, definitions: { start: 25, latest: false } };
  const next = resetContextPages(queries);
  expect(next.runtime).toMatchObject({ start: 0, definitionId: undefined, search: 'order' });
  expect(next.history).toMatchObject({ start: 0, finished: false });
  expect(next.jobs).toMatchObject({ start: 0, executionId: 'e' });
  expect(next.definitions).toEqual(queries.definitions); expect(queries.runtime.definitionId).toBe('old');
});
