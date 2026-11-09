import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { RecentFiles } from '../../src/desktop/recent-files';
it('хранит 15 уникальных недавних путей, удаление сохраняется между запусками', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'desk-recent-'));
  try {
    const store = new RecentFiles(directory); await store.load();
    for (let index = 0; index < 17; index++) await store.add(`/tmp/${index}.bpmn`);
    expect(store.list()).toHaveLength(15); expect(store.list()).not.toContain('/tmp/1.bpmn');
    await store.add('/tmp/10.bpmn'); expect(store.list()[0]).toBe('/tmp/10.bpmn'); expect(store.list()).toHaveLength(15);
    await store.remove('/tmp/10.bpmn'); const reopened = new RecentFiles(directory); await reopened.load();
    expect(reopened.list()).toHaveLength(14); expect(reopened.list()).not.toContain('/tmp/10.bpmn');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
