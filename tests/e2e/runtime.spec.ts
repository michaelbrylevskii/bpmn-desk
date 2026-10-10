import { test, expect, _electron as electron } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectOption } from './select';
import { fixture, launch, openInstance, close, useRuntimeFixture } from './runtime-fixture';
useRuntimeFixture();

test('реальный Flowable: точная версия экземпляра, переменные и отдельная локальная копия', async () => {
  const { app, page, directory } = await launch();
  try {
    await openInstance(page, fixture.reviewInstanceId);
    await expect(page.locator('.runtime-diagram-heading')).toContainText('v1');
    await expect(page.locator('.runtime-canvas')).toContainText('Review document');
    await expect(page.locator('.runtime-canvas')).not.toContainText('Review document v2');
    await page.locator('.runtime-variable').filter({ hasText: 'documentId' }).locator('summary').click();
    await expect(page.locator('.runtime-variable').filter({ hasText: 'documentId' })).toContainText('DOC-001');
    await page.locator('.runtime-variable').filter({ hasText: 'payload' }).locator('summary').click();
    await expect(page.locator('.runtime-variable').filter({ hasText: 'payload' })).toContainText('"ready": true');
    await expect(page.locator('.runtime-canvas .djs-palette')).toHaveCount(0);
    const disk = await readFile(resolve(directory, 'connections.json'), 'utf8'); expect(disk).not.toContain('fixture-password');
    await page.getByRole('button', { name: 'Create local copy', exact: true }).click();
    await expect(page.locator('.document-tabs')).toContainText('deskReview.bpmn20.xml'); await expect(page.locator('.workspaces .djs-palette')).toBeVisible();
  } finally { await close(app, directory); }
});

test('реальный Flowable: multi-instance, executions и локальные переменные', async () => {
  const { app, page, directory } = await launch();
  try {
    await openInstance(page, fixture.parallelInstanceId);
    await expect(page.locator('.runtime-canvas .runtime-badge[data-activity-id="ReviewMany"]')).toHaveText('3');
    await expect(page.locator('.runtime-canvas .runtime-badge[data-activity-id="ReviewA"]')).toHaveText('1');
    await page.locator('.runtime-details').getByRole('button', { name: 'Executions', exact: true }).click();
    const execution = page.locator('.runtime-execution').filter({ has: page.getByRole('button', { name: 'ReviewA', exact: true }) });
    await execution.getByRole('button', { name: 'Open execution variables', exact: true }).click();
    await page.locator('.runtime-variable').filter({ hasText: 'localReviewerNote' }).locator('summary').click();
    await expect(page.locator('.runtime-variable').filter({ hasText: 'localReviewerNote' })).toContainText('execution-specific value');
    const canvas = await page.locator('.runtime-canvas .djs-container').elementHandle();
    const transform = await page.locator('.runtime-canvas .viewport').getAttribute('transform');
    const time = page.locator('.runtime-freshness time'); const before = await time.getAttribute('datetime');
    await page.getByRole('button', { name: 'Refresh state', exact: true }).click();
    await expect(time).not.toHaveAttribute('datetime', before!);
    expect(await canvas?.evaluate(node => node.isConnected)).toBe(true);
    await expect(page.locator('.runtime-canvas .viewport')).toHaveAttribute('transform', transform!);
    const manual = await time.getAttribute('datetime'); await page.getByLabel('Refresh every 5 seconds').check();
    await expect(time).not.toHaveAttribute('datetime', manual!);
    const immediate = await time.getAttribute('datetime'); await expect(time).not.toHaveAttribute('datetime', immediate!, { timeout: 10000 });
    await expect(page.locator('.runtime-canvas .runtime-badge[data-activity-id="ReviewMany"]')).toHaveText('3');
    await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click();
    await page.getByRole('button', { name: 'BPMN 2.0', exact: true }).click();
    await page.locator('.document-tab[data-kind=monitor]').getByRole('tab').click();
    await expect(page.locator('.runtime-canvas .viewport')).toHaveAttribute('transform', transform!);
    await page.screenshot({ path: 'test-results/runtime-parallel.png' });
  } finally { await close(app, directory); }
});

test('реальный Flowable: dead-letter список, место ошибки, stacktrace и переменные', async () => {
  const { app, page, directory } = await launch();
  try {
    await page.locator('.runtime-catalog').getByRole('button', { name: 'Dead-letter jobs', exact: true }).click();
    await page.locator('.runtime-catalog .runtime-row').filter({ hasText: 'Send document' }).click();
    await expect(page.locator('.runtime-instance > code')).toHaveText(fixture.failedInstanceId);
    await expect(page.locator('.runtime-canvas .djs-element[data-element-id="Delivery"]')).toHaveClass(/runtime-failed/);
    await page.locator('.runtime-details .runtime-job summary').click();
    await expect(page.locator('.runtime-job pre')).toContainText('Fixture failure: remote system is unavailable');
    await page.locator('.runtime-details').getByRole('button', { name: 'Process variables', exact: true }).click();
    await page.locator('.runtime-variable').filter({ hasText: 'amount' }).locator('summary').click();
    await expect(page.locator('.runtime-variable').filter({ hasText: 'amount' })).toContainText('42');
    await page.getByRole('button', { name: 'Dead-letter jobs present: 1', exact: true }).click();
    await expect(page.locator('.runtime-details').getByRole('button', { name: 'Dead-letter jobs (1)', exact: true })).toBeFocused();
    await expect(page.locator('.runtime-job summary')).toBeVisible();
    await page.locator('.runtime-details .runtime-job > .runtime-link').click();
    await expect(page.locator('.runtime-canvas .djs-element[data-element-id="Delivery"]')).toHaveClass(/selected/);
    await page.locator('.runtime-details').getByRole('button', { name: 'Tasks', exact: true }).click();
    await expect(page.locator('.runtime-detail-body')).toHaveText('No results');
    await page.locator('.runtime-details').getByRole('button', { name: 'Executions', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Scope', exact: true })).toHaveCount(0);
    await page.locator('.runtime-catalog .runtime-row').filter({ hasText: 'Send document' }).click();
    await expect(page.locator('.runtime-job summary')).toBeVisible();
    await page.screenshot({ path: 'test-results/runtime-dead-letter.png' });
  } finally { await close(app, directory); }
});

test('подключения: несколько профилей, выбор, ошибка авторизации и восстановление после перезапуска', async () => {
  const { app, page, directory } = await launch();
  try {
    await page.getByRole('button', { name: 'Manage connections', exact: true }).click();
    await page.getByRole('button', { name: 'New connection', exact: true }).click();
    await page.getByLabel('Connection name').fill('No credentials'); await page.getByLabel('REST API URL').fill(fixture.baseUrl);
    await selectOption(page.getByLabel('Authentication', { exact: true }), 'none'); await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await selectOption(page.getByLabel('Select a connection'), { label: 'No credentials' });
    await expect(page.locator('.runtime-catalog [role="alert"]')).toContainText('401');
    await selectOption(page.getByLabel('Select a connection'), { label: 'Fixture engine' });
    await expect(page.locator('.runtime-catalog .runtime-row').first()).toBeVisible();
    await page.getByRole('button', { name: 'Manage connections', exact: true }).click();
    await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Connection verified');
    await page.keyboard.press('Escape'); await selectOption(page.getByLabel('Select a connection'), { label: 'No credentials' });
    await expect(page.locator('.runtime-catalog [role="alert"]')).toContainText('401');
  } finally { await app.close(); }
  const reopened = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await reopened.firstWindow(); await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click();
    await page.getByLabel('Select a connection').click();
    await expect(page.getByRole('option')).toHaveCount(3); await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox', { name: 'Select a connection' })).toContainText('No credentials');
    await page.getByRole('button', { name: 'Open monitor', exact: true }).click();
    await expect(page.locator('.runtime-catalog [role="alert"]')).toContainText('401');
    await selectOption(page.getByLabel('Select a connection'), { label: 'Fixture engine' });
    await expect(page.locator('.runtime-catalog [role="alert"]')).toContainText('Enter the connection password or token');
  } finally { await close(reopened, directory); }
});

test('runtime интерфейс поддерживает тёмную тему и русскую локаль', async () => {
  const { app, page, directory } = await launch();
  try {
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
    await openInstance(page, fixture.failedInstanceId);
    await selectOption(page.getByLabel('Language'), 'ru');
    await expect(page.getByRole('button', { name: 'Создать локальную копию', exact: true })).toBeVisible();
    await expect(page.locator('.runtime-instance')).toContainText('Есть dead-letter jobs');
    await page.locator('.runtime-details').getByRole('button', { name: 'Dead-letter jobs (1)', exact: true }).click();
    await page.locator('.runtime-job summary').click();
    await expect(page.locator('.runtime-job pre')).toContainText('IllegalStateException');
    await page.screenshot({ path: 'test-results/runtime-dark-russian.png' });
  } finally { await close(app, directory); }
});

test('вызванный процесс открывает точную схему и позволяет перейти к родителю', async () => {
  const { app, page, directory } = await launch();
  try {
    await openInstance(page, fixture.childInstanceId);
    await expect(page.locator('.runtime-diagram-heading')).toContainText('v2');
    await page.getByRole('button', { name: `Parent instance: ${fixture.parentInstanceId}`, exact: true }).click();
    await expect(page.locator('.runtime-instance > code')).toHaveText(fixture.parentInstanceId);
    await expect(page.locator('.runtime-canvas .djs-element[data-element-id="Child"]')).toHaveClass(/runtime-active/);
  } finally { await close(app, directory); }
});

test('REST: тест черновика без сохранения, пагинация, metadata и дочерние экземпляры', async () => {
  const { app, page, directory } = await launch();
  try {
    const result = await page.evaluate(async ({ url, parent }) => {
      const api = window.runtime!; const before = await api.connections(); const id = before.items[0]!.id;
      await api.testConnectionDraft({ name: '', engine: 'flowable', baseUrl: url, authentication: 'basic', username: 'desk-reader', secret: 'fixture-password', rememberSecret: false });
      const definitions = await api.definitions(id, { size: 2, sort: 'version', order: 'desc' });
      const instances = await api.instances(id, { definitionKey: 'deskParallel', suspended: false, size: 10 });
      return { before: before.items.length, after: (await api.connections()).items.length, definitions, instances, snapshot: await api.snapshot(id, parent) };
    }, { url: fixture.baseUrl, parent: fixture.parentInstanceId });
    expect(result.after).toBe(result.before); expect(result.definitions.data).toHaveLength(2); expect(result.definitions.data[0]?.version).toBe(2);
    expect(result.instances.data).toHaveLength(1); expect(result.instances.data[0]?.processDefinitionName).toBe('deskParallel');
    expect(result.snapshot.children.map(child => child.id)).toContain(fixture.childInstanceId);
  } finally { await close(app, directory); }
});
