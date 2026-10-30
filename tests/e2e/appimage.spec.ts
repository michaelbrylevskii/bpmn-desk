import { selectOption } from './select';
import { createDiagram } from './create-diagram';
import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import packageInfo from '../../package.json' with { type: 'json' };
import { packagedWindow, type PackagedView } from './packaged-window';
import { historyServer } from './history-server';

const image = resolve(`release/BPMN-Desk-${packageInfo.version}-x86_64.AppImage`);
test('извлечённая AppImage открывает демонстрационную схему с включённым sandbox', async () => {
  test.skip(process.platform !== 'linux' || !existsSync(image), 'Сначала собери Linux AppImage.');
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-appimage-'));
  // В test sandbox нет /dev/fuse; проверяем содержимое самого артефакта.
  const extraction = spawnSync(image, ['--appimage-extract'], { cwd: directory, stdio: 'ignore' });
  expect(extraction.status).toBe(0);
  const app = await electron.launch({ executablePath: resolve(directory, 'squashfs-root/bpmn-desk'), chromiumSandbox: true,
    args: [resolve('examples/flowable-showcase.bpmn20.xml')],
    env: { ...process.env, BPMN_DESK_USER_DATA: resolve(directory, 'profile'), ELECTRON_RENDERER_URL: '' }, timeout: 30_000 });
  let view: PackagedView | undefined;
  try {
    view = await packagedWindow(app);
    const { page } = view;
    await expect(page.locator('.document-tab')).toContainText('flowable-showcase.bpmn20.xml');
    await expect(page.locator('.djs-element[data-element-id="reviewDocument"]')).toBeVisible();
    expect(await app.evaluate(({ app }) => app.commandLine.hasSwitch('no-sandbox'))).toBe(false);
    expect(await page.evaluate(() => 'require' in window)).toBe(false);
    await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveAttribute('data-value', 'en');
    await page.getByRole('button', { name: 'XML', exact: true }).click();
    await page.getByLabel('Diagram XML').focus();
    await page.keyboard.press('Control+f');
    await expect(page.locator('.xml-panel').getByRole('textbox', { name: 'Find', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/appimage-editor.png' });
    // Новые действия проверяются также в собранном приложении с native меню.
    await page.getByLabel('Find element').fill('prepareDocument'); await page.locator('.outline-item').first().click();
    await page.locator('.bpmn-container .djs-container > svg').focus(); await page.keyboard.press('Control+c');
    await page.locator('.new-tab').click(); await createDiagram(page, 'BPMN 2.0');
    const canvas = page.locator('.document-workspace:visible .bpmn-container .djs-container > svg');
    await canvas.focus(); const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.7);
    await page.keyboard.press('Control+v'); await page.mouse.click(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.7);
    await expect(page.locator('.document-workspace:visible .outline-item[title^="bpmn:ServiceTask"]')).toHaveCount(1);
    const sourceTab = page.locator('.document-tab').first().getByRole('tab'); const sourceId = await sourceTab.getAttribute('data-tab-id');
    const destination = page.locator('.document-tab').last().getByRole('tab'); const destinationId = await destination.getAttribute('data-tab-id');
    const tabBounds = (await destination.boundingBox())!;
    await sourceTab.dragTo(destination, { targetPosition: { x: tabBounds.width - 5, y: tabBounds.height / 2 } });
    expect(await page.getByRole('tab').evaluateAll(elements => elements.map(element => element.getAttribute('data-tab-id')))).toEqual([destinationId, sourceId]);
    await expect(page.locator(`[data-tab-id="${destinationId}"]`)).toHaveAttribute('aria-selected', 'true');
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await expect(page.locator('.document-workspace:visible .outline-item[title^="bpmn:ServiceTask"]')).toHaveCount(0);
    await page.getByTitle('Close New diagram.bpmn', { exact: true }).click();
    await expect(page.locator('.djs-element[data-element-id="prepareDocument"]')).toBeVisible();
    await expect(page.getByTitle('Undo (Ctrl+Z)', { exact: true })).toBeDisabled();
    await page.getByLabel('Find element').fill('preparedFlow'); await page.locator('.outline-item').first().click();
    await selectOption(page.getByLabel('Default flow', { exact: true }), 'true');
    await expect(page.getByLabel('Diagram XML')).toContainText('default="preparedFlow"');
    await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await expect(page.getByLabel('Diagram XML')).not.toContainText('default="preparedFlow"');
    await page.getByTitle('Close flowable-showcase.bpmn20.xml', { exact: true }).click();
    await page.getByRole('button', { name: 'camunda7-showcase', exact: true }).click();
    await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
    await expect(page.locator('.djs-element[data-element-id="ArchiveOrder"]')).toBeVisible();
    await page.getByLabel('Find element').fill('ArchiveOrder');
    await page.locator('.outline-item').first().click();
    await expect(page.getByLabel('External task topic', { exact: true })).toHaveValue('archive-order');
    await selectOption(page.getByRole('combobox', { name: 'Language', exact: true }), 'ru');
    await expect(page.getByLabel('Тема внешней задачи', { exact: true })).toHaveValue('archive-order');
    await page.getByRole('button', { name: 'Диагностика', exact: false }).click();
    await expect(page.locator('.diagnostics-panel')).toContainText('Проблем не обнаружено');
  } finally { await view?.browser.close(); await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('AppImage читает историю через production IPC и связывает журнал со схемой', async () => {
  test.skip(process.platform !== 'linux' || !existsSync(image), 'Сначала собери Linux AppImage.');
  const api = await historyServer();
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-history-appimage-'));
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined; let view: PackagedView | undefined;
  try {
    expect(spawnSync(image, ['--appimage-extract'], { cwd: directory, stdio: 'ignore' }).status).toBe(0);
    app = await electron.launch({ executablePath: resolve(directory, 'squashfs-root/bpmn-desk'), chromiumSandbox: true,
      env: { ...process.env, BPMN_DESK_USER_DATA: resolve(directory, 'profile'), ELECTRON_RENDERER_URL: '' }, timeout: 30000 });
    view = await packagedWindow(app); const { page } = view;
    await selectOption(page.getByRole('combobox', { name: 'Select a connection', exact: true }), '@new');
    await page.getByLabel('Connection name', { exact: true }).fill('History fixture');
    await page.getByLabel('REST API URL', { exact: true }).fill(api.baseUrl);
    await selectOption(page.getByRole('combobox', { name: 'Authentication', exact: true }), 'none');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await page.getByRole('button', { name: 'Open monitor', exact: true }).click();
    await page.locator('.runtime-catalog > .runtime-tabs').getByRole('button', { name: 'Instances', exact: true }).click();
    await selectOption(page.getByRole('combobox', { name: 'Instance view', exact: true }), 'completed');
    await page.getByLabel('Instance ID', { exact: true }).fill('p1'); await page.getByRole('button', { name: 'Open instance', exact: true }).click();
    await expect(page.locator('.history-activity')).toHaveCount(2);
    await page.locator('.history-activity').last().getByRole('button').click();
    await expect(page.locator('.runtime-canvas .djs-element[data-element-id="HistoryReview"]')).toHaveClass(/selected/);
    await expect(page.locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('✓ 2');
    await selectOption(page.getByRole('combobox', { name: 'Language', exact: true }), 'ru');
    await expect(page.locator('.history-activity').last()).toContainText('Проход 2 из 2');
    await expect(page.locator('.instance-mode-tabs')).toContainText('История выполнения');
    expect(await app.evaluate(({ app }) => app.commandLine.hasSwitch('no-sandbox'))).toBe(false);
    await page.screenshot({ path: 'test-results/appimage-history.png' });
  } finally { await view?.browser.close(); await app?.close(); await api.stop(); await rm(directory, { recursive: true, force: true }); }
});
