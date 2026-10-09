import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

test('dev-сервер не отдаёт содержимое локальных схем и кешей', async ({ request }) => {
  const name = `dev-policy-${randomUUID()}`;
  for (const parent of ['.local-schemas', '.cache']) {
    const directory = join(parent, name);
    mkdirSync(directory, { recursive: true });
    try {
      writeFileSync(join(directory, 'schema.bpmn'), '<private-test-sentinel />');
      const response = await request.get(`/${parent}/${name}/schema.bpmn`);
      expect(response.status()).toBe(403);
      expect(await response.text()).not.toContain('private-test-sentinel');
    } finally { rmSync(directory, { recursive: true, force: true }); }
  }
});
