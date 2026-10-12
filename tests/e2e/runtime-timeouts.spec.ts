import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { launch, close } from './runtime-fixture';

test('медленный список: таймаут черновика и сохранённого подключения, восстановление без автоматических повторов', async () => {
  let delay = 6000; let requests = 0;
  const server = createServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    if (request.url?.includes('/process-instances')) {
      requests++; response.write('{');
      const timer = setTimeout(() => response.end('"data":[{"id":"p1","processDefinitionId":"d1","businessKey":"Example order"}],"start":0,"total":1}'), delay);
      response.on('close', () => clearTimeout(timer)); return;
    }
    response.end('{"data":[{"id":"d1","key":"example","name":"Example process","version":1}],"start":0,"total":1}');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  const launched = await launch(`http://127.0.0.1:${address.port}/process-api/`).catch(async error => {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); throw error;
  });
  const { app, page, directory } = launched;
  const manage = async (seconds: number) => {
    await page.getByTitle('Manage connections', { exact: true }).click();
    const timeout = page.getByLabel('Request timeout, seconds', { exact: true });
    await expect(timeout).toHaveValue('15'); await timeout.fill(String(seconds));
  };
  try {
    await manage(5);
    await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Connection verified.');
    expect((await page.evaluate(() => window.runtime!.connections())).items[0]?.requestTimeoutSeconds).toBe(15);
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const tabs = page.locator('.runtime-catalog > .runtime-tabs');
    await tabs.getByRole('button', { name: 'Instances', exact: true }).click();
    await expect(page.locator('.runtime-list [role=alert]')).toContainText('API request timed out.', { timeout: 8000 });
    expect(requests).toBe(1);
    await page.getByTitle('Manage connections', { exact: true }).click();
    await expect(page.getByLabel('Request timeout, seconds', { exact: true })).toHaveValue('5');
    await page.getByLabel('Request timeout, seconds', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(page.locator('.runtime-row').filter({ hasText: 'Example order' })).toBeVisible({ timeout: 10000 });
    expect(requests).toBe(2);
    expect((JSON.parse(await readFile(join(directory, 'connections.json'), 'utf8')) as { items: { profile: { requestTimeoutSeconds: number } }[] }).items[0]?.profile.requestTimeoutSeconds).toBe(30);
    delay = 0;
  } finally {
    try { await close(app, directory); }
    finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});
