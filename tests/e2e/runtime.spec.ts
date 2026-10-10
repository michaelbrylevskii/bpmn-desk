import { test, expect, _electron as electron, type Page, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

interface Fixture { baseUrl: string; parallelInstanceId: string; failedInstanceId: string; reviewInstanceId: string; reviewDefinitionId: string; parentInstanceId: string; childInstanceId: string }
let fixture: Fixture;
test.skip(!process.env.BPMN_DESK_RUNTIME_FIXTURE, 'Запускается через npm run test:runtime с независимым Flowable.');
test.beforeAll(async () => { fixture = JSON.parse(await readFile(process.env.BPMN_DESK_RUNTIME_FIXTURE!, 'utf8')) as Fixture; });

async function launch(): Promise<{ app: ElectronApplication; page: Page; directory: string }> {
  const directory = await mkdtemp(resolve(tmpdir(), 'desk-runtime-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Process monitor', exact: true }).click();
  await page.getByRole('button', { name: 'New connection', exact: true }).click();
  await page.getByLabel('Connection name').fill('Fixture engine'); await page.getByLabel('REST API URL').fill(fixture.baseUrl);
  await page.getByLabel('Username', { exact: true }).fill('desk-reader'); await page.getByLabel('Password or token').fill('fixture-password');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.runtime-catalog .runtime-row').first()).toBeVisible();
  return { app, page, directory };
}
async function openInstance(page: Page, id: string) {
  await page.getByLabel('Instance ID', { exact: true }).fill(id); await page.getByRole('button', { name: 'Open instance', exact: true }).click();
  await expect(page.locator('.runtime-instance > code')).toHaveText(id);
}
async function close(app: ElectronApplication, directory: string) { await app.close(); await rm(directory, { recursive: true, force: true }); }

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
    await page.getByRole('button', { name: 'Process monitor', exact: true }).click();
    await page.getByRole('button', { name: 'Process monitor', exact: true }).click();
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
    await page.getByLabel('Authentication', { exact: true }).selectOption('none'); await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(page.locator('.runtime-catalog [role="alert"]')).toContainText('401');
    await page.getByLabel('Select a connection').selectOption({ label: 'Fixture engine · Flowable' });
    await expect(page.locator('.runtime-catalog .runtime-row').first()).toBeVisible();
    await page.getByRole('button', { name: 'Manage connections', exact: true }).click();
    await page.getByRole('button', { name: 'Test saved connection', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Connection verified');
  } finally { await app.close(); }
  const reopened = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await reopened.firstWindow(); await page.getByRole('button', { name: 'Process monitor', exact: true }).click();
    await expect(page.getByLabel('Select a connection').locator('option')).toHaveCount(3);
    await expect(page.locator('.runtime-catalog [role="alert"]')).toContainText('Enter the connection password or token');
  } finally { await close(reopened, directory); }
});

test('runtime интерфейс поддерживает тёмную тему и русскую локаль', async () => {
  const { app, page, directory } = await launch();
  try {
    await page.getByRole('button', { name: 'Dark theme', exact: true }).click();
    await openInstance(page, fixture.failedInstanceId);
    await page.getByLabel('Language').selectOption('ru');
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
