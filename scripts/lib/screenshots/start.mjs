import { _electron as electron, expect } from '@playwright/test';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { viewport } from './editor.mjs';

/** Стартовая страница desktop с реальными недавними файлами и снимком сессии. */
export async function captureStart() {
  const directory = await mkdtemp(join(tmpdir(), 'bpmn-desk-start-docs-'));
  let app;
  const launch = async () => {
    const instance = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
    const page = await instance.firstWindow(); page.setDefaultTimeout(20000); await page.setViewportSize(viewport);
    return { instance, page };
  };
  try {
    const files = await Promise.all(['flowable-showcase', 'camunda7-showcase'].map(async name => {
      const file = join(directory, `${name}.bpmn20.xml`);
      await copyFile(resolve('examples', `${name}.bpmn20.xml`), file); return file;
    }));
    let window = await launch(); app = window.instance;
    await window.page.getByTitle('Light theme', { exact: true }).click();
    await app.evaluate(({ dialog }, files) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: files });
      dialog.showMessageBoxSync = () => 1;
    }, files);
    await window.page.getByTitle('Open (Ctrl+O)', { exact: true }).click();
    await expect(window.page.getByRole('tab')).toHaveCount(2);
    await window.page.getByRole('tab', { name: 'flowable-showcase.bpmn20.xml', exact: true }).click();
    await window.page.getByRole('textbox', { name: 'Find element', exact: true }).fill('prepareDocument');
    await window.page.locator('.outline-item').first().click();
    await window.page.getByLabel('Name', { exact: true }).filter({ visible: true }).fill('Prepare document package');
    await window.page.getByLabel('Name', { exact: true }).filter({ visible: true }).blur();
    await expect.poll(() => window.page.evaluate(async () => (await globalThis.desktop.sessions()).length)).toBeGreaterThan(0);
    await app.close(); app = undefined;
    window = await launch(); app = window.instance;
    await window.page.getByRole('button', { name: 'Pin session', exact: true }).click();
    await window.page.getByRole('textbox', { name: 'Session name', exact: true }).fill('Document review');
    await window.page.getByRole('button', { name: 'Save name and pin', exact: true }).click();
    await expect(window.page.locator('.session-entry[data-pinned=true]')).toBeVisible();
    await expect(window.page.getByRole('button', { name: 'Open monitor', exact: true })).toBeEnabled();
    await window.page.evaluate(() => globalThis.document.fonts.ready); await window.page.mouse.move(1590, 990);
    await window.page.screenshot({ path: 'docs/images/start.png' });
  } finally {
    await app?.close(); await rm(directory, { recursive: true, force: true });
  }
}
