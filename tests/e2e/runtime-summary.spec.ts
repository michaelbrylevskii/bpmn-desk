import { test, expect, type Page } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixture, launch, openInstance, close, useRuntimeFixture } from './runtime-fixture';
useRuntimeFixture();

async function definition(page: Page, key: string, version?: number) {
  await page.locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'Processes', exact: true }).click();
  let row = page.locator('.runtime-catalog .runtime-row').filter({ hasText: key });
  if (version) row = row.filter({ hasText: `· v${version}` });
  await row.first().locator('button').first().click();
  await expect(page.locator('.runtime-diagram-heading')).toContainText(key);
}

test('сводка точной версии: multi-instance считается один раз, ошибки и экспорт, latest сохраняет старый экземпляр', async () => {
  const { app, page, directory } = await launch();
  try {
    await definition(page, 'deskParallel');
    await expect(page.locator('.runtime-badge')).toHaveCount(0);
    await page.getByRole('button', { name: 'Version summary', exact: true }).click();
    await expect(page.locator('.runtime-badge[data-activity-id="ReviewMany"]')).toHaveText('1');
    await expect(page.locator('.runtime-summary-notice')).not.toContainText('Partial summary');
    await page.locator('.runtime-canvas .djs-element[data-element-id="ReviewMany"] .djs-hit').click();
    await expect(page.locator('.runtime-summary-details .related-instance')).toHaveCount(1);
    await page.locator('.runtime-summary-details').getByRole('button', { name: `Open instance: ${fixture.parallelInstanceId}`, exact: true }).click();
    await expect(page.locator('.runtime-instance > code')).toHaveText(fixture.parallelInstanceId);
    await expect(page.locator('.runtime-badge[data-activity-id="ReviewMany"]')).toHaveText('3');
    await definition(page, 'deskParallel'); await page.getByRole('button', { name: 'Version summary', exact: true }).click();
    await expect(page.locator('.runtime-badge[data-activity-id="ReviewMany"]')).toHaveText('1');
    await page.getByTitle('Hide summary', { exact: true }).click(); await expect(page.locator('.runtime-badge')).toHaveCount(0);
    await definition(page, 'deskFailure');
    await page.getByRole('button', { name: 'Version summary', exact: true }).click();
    await expect(page.locator('.runtime-badge.failed[data-activity-id="Delivery"]')).toHaveText('! 1');
    const filePath = resolve(directory, 'definition-summary.svg');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, filePath);
    await page.getByTitle('Export SVG', { exact: true }).click();
    await expect(async () => { expect(await readFile(filePath, 'utf8')).toContain('>! 1</text>'); }).toPass();
    await page.locator('.runtime-canvas .djs-element[data-element-id="Delivery"] .djs-hit').click();
    await page.locator('.runtime-summary-details').getByRole('button', { name: `Open instance: ${fixture.failedInstanceId}`, exact: true }).click();
    await expect(page.locator('.runtime-details .runtime-job summary')).toBeVisible();
    await expect(page.locator('.runtime-instance > code')).toHaveText(fixture.failedInstanceId);
    await page.locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'Processes', exact: true }).click();
    const filters = page.locator('.catalog-filters'); await filters.locator('summary').click();
    await filters.getByLabel('Latest versions only', { exact: true }).check();
    await filters.getByLabel('Process key', { exact: true }).fill('deskReview');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect(page.locator('.runtime-catalog .runtime-row')).toHaveCount(1);
    await expect(page.locator('.runtime-catalog .runtime-row')).toContainText('· v2');
    await page.getByLabel('Process name', { exact: true }).fill('deskReview');
    await page.locator('.runtime-query').getByTitle('Search', { exact: true }).click();
    await expect(page.locator('.runtime-catalog .runtime-row')).toHaveCount(1);
    await openInstance(page, fixture.reviewInstanceId); await expect(page.locator('.runtime-diagram-heading')).toContainText('v1');
    await expect(page.locator('.runtime-summary-notice')).toHaveCount(0);
    await expect(page.locator('.runtime-badge[data-activity-id="Review"]')).toHaveText('1');
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
  } finally { await close(app, directory); }
});

test('ограниченная сводка и медленный сервер не блокируют переходы, не создают N+1 и не применяют поздний ответ', async () => {
  const requests: URL[] = []; let mode: 'sample' | 'slow' = 'sample'; let denyDetails = false;
  const server = createServer((request, response) => {
    const url = new URL(request.url!, new URL(fixture.baseUrl).origin); requests.push(url);
    if (denyDetails && ['/deadletter-jobs', '/tasks', '/variables'].some(path => url.pathname.endsWith(path))) { response.setHeader('content-type', 'application/json'); response.statusCode = 403; response.end('{}'); return; }
    const summary = url.searchParams.has('processDefinitionId') && (url.pathname.endsWith('/executions') || url.pathname.endsWith('/deadletter-jobs'));
    if (summary) {
      response.setHeader('content-type', 'application/json');
      if (mode === 'slow') { response.write('{'); return; }
      if (url.pathname.endsWith('/deadletter-jobs')) { response.statusCode = 403; response.end('{}'); return; }
      response.end(JSON.stringify({ start: 0, total: 1000000, data: Array.from({ length: 100 }, (_, index) => ({ id: `e${index}`, activityId: 'Review', processInstanceId: `p${index % 25}` })) })); return;
    }
    void fetch(url, { headers: { Authorization: request.headers.authorization ?? '' } }).then(async upstream => {
      response.statusCode = upstream.status; response.setHeader('content-type', upstream.headers.get('content-type') ?? 'application/json'); response.end(Buffer.from(await upstream.arrayBuffer()));
    }).catch(() => { response.statusCode = 502; response.end('{}'); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  const { app, page, directory } = await launch(`http://127.0.0.1:${address.port}/process-api/`).catch(async error => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); throw error; });
  const summaryRequests = () => requests.filter(url => url.searchParams.has('processDefinitionId') && (url.pathname.endsWith('/executions') || url.pathname.endsWith('/deadletter-jobs')));
  try {
    await definition(page, 'deskReview', 1); expect(summaryRequests()).toHaveLength(0);
    await page.getByRole('button', { name: 'Version summary', exact: true }).click();
    await expect(page.locator('.runtime-badge[data-activity-id="Review"]')).toHaveText('≥25');
    await expect(page.locator('.runtime-summary-notice')).toContainText('100/1000000');
    await expect(page.locator('.runtime-summary-notice')).toContainText('Partial summary');
    await expect(page.locator('.runtime-summary-notice')).toContainText('403'); expect(summaryRequests()).toHaveLength(2);
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await page.setViewportSize({ width: 1050, height: 680 });
      expect(await page.locator('.runtime-diagram-heading').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await expect.poll(async () => {
        const badge = await page.locator('.runtime-badge[data-activity-id="Review"]').boundingBox(); const canvas = await page.locator('.runtime-canvas').boundingBox();
        return !!badge && !!canvas && badge.x >= canvas.x && badge.x + badge.width <= canvas.x + canvas.width && badge.y >= canvas.y && badge.y + badge.height <= canvas.y + canvas.height;
      }).toBe(true);
      await page.screenshot({ path: `test-results/runtime-summary-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    }
    await page.locator('.runtime-canvas .djs-element[data-element-id="Review"] .djs-hit').click();
    await expect(page.locator('.runtime-summary-details .related-instance')).toHaveCount(10);
    await page.locator('.runtime-summary-details').getByTitle('Next page', { exact: true }).click();
    await expect(page.locator('.runtime-summary-details').getByRole('button', { name: 'Open instance: p10', exact: true })).toBeVisible();
    await page.locator('.runtime-summary-details').getByTitle('Next page', { exact: true }).click();
    await expect(page.locator('.runtime-summary-details .related-instance')).toHaveCount(5);
    expect(summaryRequests()).toHaveLength(2);
    mode = 'slow'; await page.getByRole('button', { name: 'Refresh summary', exact: true }).click();
    await expect.poll(() => summaryRequests().length).toBe(4);
    await expect(page.getByRole('button', { name: 'Version summary', exact: true })).toBeDisabled();
    await definition(page, 'deskParallel');
    await expect(page.locator('.runtime-canvas')).toContainText('Team review'); await expect(page.locator('.runtime-summary-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Version summary', exact: true })).toBeEnabled({ timeout: 12000 });
    await expect(page.locator('.runtime-badge')).toHaveCount(0); expect(summaryRequests()).toHaveLength(4);
    await page.getByRole('button', { name: 'Version summary', exact: true }).click();
    await expect(page.locator('.runtime-summary-notice')).toContainText('API request timed out.', { timeout: 12000 });
    expect(summaryRequests()).toHaveLength(6);
    await openInstance(page, fixture.reviewInstanceId);
    await page.locator('.runtime-variables > input').fill('missing-variable'); await expect(page.locator('.runtime-variables')).toContainText('No results');
    await expect(page.locator('.runtime-catalog .runtime-instance-status')).toHaveCount(0);
    await expect(page.locator('.runtime-list').getByText('Active', { exact: true })).toHaveCount(0);
    await expect(page.locator('.runtime-instance').getByText('Active', { exact: true })).toBeVisible();
    await expect(page.locator('.runtime-summary-notice')).toHaveCount(0);
    denyDetails = true; await page.getByTitle('Refresh state', { exact: true }).click();
    await expect(page.locator('.runtime-variables')).toContainText('State unavailable');
    await page.locator('.runtime-details').getByRole('button', { name: 'Dead-letter jobs (—)', exact: true }).click();
    await expect(page.locator('.runtime-detail-body')).toHaveText('State unavailable');
    await page.locator('.runtime-details').getByRole('button', { name: 'Tasks', exact: true }).click();
    await expect(page.locator('.runtime-detail-body')).toHaveText('State unavailable');
  } finally { await close(app, directory); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
