import { test, expect, _electron as electron, type Page, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { selectOption } from './select';
export interface Fixture { baseUrl: string; parallelInstanceId: string; failedInstanceId: string; reviewInstanceId: string; reviewDefinitionId: string; parentInstanceId: string; childInstanceId: string }
export let fixture: Fixture;
test.skip(!process.env.BPMN_DESK_RUNTIME_FIXTURE, 'Запускается через npm run test:runtime с независимым Flowable.');
test.beforeAll(async () => { fixture = JSON.parse(await readFile(process.env.BPMN_DESK_RUNTIME_FIXTURE!, 'utf8')) as Fixture; });

export async function launch(): Promise<{ app: ElectronApplication; page: Page; directory: string }> {
  const directory = await mkdtemp(resolve(tmpdir(), 'desk-runtime-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
  const page = await app.firstWindow();
  await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click();
  await selectOption(page.getByRole('combobox', { name: 'Select a connection', exact: true }), '@new');
  await page.getByLabel('Connection name').fill('Fixture engine'); await page.getByLabel('REST API URL').fill(fixture.baseUrl);
  await page.getByLabel('Username', { exact: true }).fill('desk-reader'); await page.getByLabel('Password or token').fill('fixture-password');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Manage connections' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open monitor', exact: true }).click();
  await expect(page.locator('.runtime-catalog .runtime-row').first()).toBeVisible();
  return { app, page, directory };
}
export async function openInstance(page: Page, id: string) {
  await page.locator('.workspace-surface:not([hidden]) .runtime-catalog > .runtime-tabs').getByRole('button', { name: 'Instances', exact: true }).click();
  await page.locator('.workspace-surface:not([hidden])').getByLabel('Instance ID', { exact: true }).fill(id); await page.locator('.workspace-surface:not([hidden])').getByRole('button', { name: 'Open instance', exact: true }).click();
  await expect(page.locator('.workspace-surface:not([hidden]) .runtime-instance > code')).toHaveText(id);
}
export async function close(app: ElectronApplication, directory: string) { await app.close(); await rm(directory, { recursive: true, force: true }); }
