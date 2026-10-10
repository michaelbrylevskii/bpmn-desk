import { selectOption } from './select';
import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { packagedWindow, type PackagedView } from './packaged-window';

test('готовое Windows-приложение открывает, изменяет и сохраняет BPMN', async () => {
  test.skip(process.platform !== 'win32', 'Запуск готового приложения проверяется на Windows.');
  const executablePath = process.env.BPMN_DESK_WINDOWS_EXECUTABLE ?? resolve('release/win-unpacked/BPMN Desk.exe');
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-windows-'));
  try {
    const documents = resolve(directory, 'Схемы с пробелами');
    await mkdir(documents);
    const path = resolve(documents, 'Документ.bpmn20.xml');
    await copyFile('examples/flowable-showcase.bpmn20.xml', path);
    const app = await electron.launch({ executablePath, args: [path], chromiumSandbox: true,
      env: { ...process.env, BPMN_DESK_USER_DATA: resolve(directory, 'profile'), ELECTRON_RENDERER_URL: '' } });
    let view: PackagedView | undefined;
    try {
      expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true);
      expect(await app.evaluate(({ app }) => app.commandLine.hasSwitch('no-sandbox'))).toBe(false);
      view = await packagedWindow(app);
      const { page } = view;
      expect(await page.evaluate(() => !!window.desktop && !('require' in window))).toBe(true);
      await expect(page.locator('.document-tab')).toContainText('Документ.bpmn20.xml');
      await expect(page.locator('.djs-element[data-element-id="prepareDocument"]')).toBeVisible();
      await expect(page.locator('.import-error')).toHaveCount(0);
      await expect(page.getByRole('combobox', { name: 'Language', exact: true })).toHaveAttribute('data-value', 'en');
      await page.getByRole('button', { name: 'XML', exact: true }).click();
      await page.getByLabel('Diagram XML').focus();
      await page.keyboard.press('Control+f');
      await expect(page.locator('.xml-panel').getByRole('textbox', { name: 'Find', exact: true })).toBeVisible();
      await selectOption(page.getByRole('combobox', { name: 'Language', exact: true }), 'ru');
      await page.getByRole('textbox', { name: 'Найти элемент' }).fill('prepareDocument');
      await page.locator('.outline-item').first().click();
      const field = page.getByLabel('Выражение делегата', { exact: true });
      await field.fill('${windowsEdited}');
      await field.blur();
      await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('Сохранено');
      expect(await readFile(path, 'utf8')).toContain('${windowsEdited}');
      // Наличие копий примеров проверяется через реальный packaged IPC.
      await page.getByRole('button', { name: 'Закрыть Документ.bpmn20.xml', exact: true }).click();
      await expect(page.getByRole('button', { name: 'flowable-showcase', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
      await expect(page.locator('.document-tab').last()).toContainText('flowable-showcase');
      await page.screenshot({ path: 'test-results/windows-editor.png' });
    } finally {
      await view?.browser.close();
      await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
      await app.close();
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
