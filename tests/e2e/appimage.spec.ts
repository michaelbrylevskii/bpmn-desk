import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import packageInfo from '../../package.json' with { type: 'json' };

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
  try {
    const page = await app.firstWindow();
    await expect(page.locator('.document-tab')).toContainText('flowable-showcase.bpmn20.xml');
    await expect(page.locator('.djs-element[data-element-id="reviewDocument"]')).toBeVisible();
    expect(await app.evaluate(({ app }) => app.commandLine.hasSwitch('no-sandbox'))).toBe(false);
    expect(await page.evaluate(() => 'require' in window)).toBe(false);
    await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveValue('en');
    await page.getByRole('button', { name: 'XML', exact: true }).click();
    await page.getByLabel('Diagram XML').focus();
    await page.keyboard.press('Control+f');
    await expect(page.locator('.xml-panel').getByRole('textbox', { name: 'Find', exact: true })).toBeVisible();
    await page.screenshot({ path: 'test-results/appimage-editor.png' });
    await page.getByTitle('Close flowable-showcase.bpmn20.xml', { exact: true }).click();
    await page.getByRole('button', { name: 'camunda7-showcase', exact: true }).click();
    await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
    await expect(page.locator('.djs-element[data-element-id="ArchiveOrder"]')).toBeVisible();
    await page.getByLabel('Find element').fill('ArchiveOrder');
    await page.locator('.outline-item').first().click();
    await expect(page.getByLabel('External task topic', { exact: true })).toHaveValue('archive-order');
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
    await expect(page.getByLabel('Тема внешней задачи', { exact: true })).toHaveValue('archive-order');
    await page.getByRole('button', { name: 'Диагностика', exact: false }).click();
    await expect(page.locator('.diagnostics-panel')).toContainText('Проблем не обнаружено');
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
