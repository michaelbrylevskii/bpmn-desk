import { expect, test } from '@playwright/test';
import { close, fixture, launch, useRuntimeFixture } from './runtime-fixture';
useRuntimeFixture();

test('Flowable фильтрует текущие и исторические экземпляры по частичному ключу и имени без учёта регистра', async () => {
  const { app, page, directory } = await launch();
  try {
    const result = await page.evaluate(async () => {
      const api = window.runtime!; const id = (await api.connections()).items[0]!.id;
      const current = await api.instances(id, { businessKeyLike: 'review:document' });
      const named = await api.instances(id, { instanceName: 'DOCUMENT REVIEW' });
      const exact = await api.instances(id, { search: 'review:document' });
      const absent = await api.instances(id, { instanceName: 'NO_SUCH_INSTANCE_987654' });
      const historical = await api.historicInstances(id, { businessKeyLike: 'history:order', finished: true });
      const historyName = await api.historicInstances(id, { instanceName: 'ORDER REVIEW', finished: true });
      const historyAbsent = await api.historicInstances(id, { instanceName: 'NO_SUCH_INSTANCE_987654', finished: true });
      return { current, named, exact, absent, historical, historyName, historyAbsent };
    });
    expect(result.current.data.map(item => item.id)).toEqual([fixture.reviewInstanceId]);
    expect(result.named.data.map(item => item.id)).toEqual([fixture.reviewInstanceId]);
    expect(result.exact.total).toBe(0); expect(result.absent.total).toBe(0);
    expect(result.historical.data.map(item => item.id)).toEqual([fixture.historyInstanceId]);
    expect(result.historyName.data.map(item => item.id)).toEqual([fixture.historyInstanceId]); expect(result.historyAbsent.total).toBe(0);
  } finally { await close(app, directory); }
});
