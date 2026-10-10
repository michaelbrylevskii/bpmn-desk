import { createDiagram } from './create-diagram';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fixture, launch, openInstance, close, useRuntimeFixture } from './runtime-fixture';
import { selectOption } from './select';
useRuntimeFixture();

const surface = (page: Page) => page.locator('.workspace-surface:not([hidden])');
async function newMonitor(page: Page) {
  await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click();
  await page.getByRole('button', { name: 'Open monitor', exact: true }).click();
  await expect(surface(page).locator('.runtime-catalog .runtime-row').first()).toBeVisible();
}

test('несколько мониторов сохраняют собственный экземпляр, фильтры и холст вместе с черновиком редактора', async () => {
  const { app, page, directory } = await launch();
  try {
    await openInstance(page, fixture.parallelInstanceId);
    const firstTab = page.getByRole('tab', { name: /deskParallel/ });
    await expect(firstTab).toBeVisible();
    const canvas = surface(page).locator('.runtime-canvas .djs-container'); const node = await canvas.elementHandle();
    const transform = await surface(page).locator('.viewport').getAttribute('transform');
    await newMonitor(page); await openInstance(page, fixture.failedInstanceId);
    const failedRow = surface(page).locator('.runtime-row').filter({ hasText: fixture.failedInstanceId });
    await expect(failedRow).toBeVisible(); await expect(failedRow.getByRole('img')).toHaveCount(0);
    await expect(failedRow.getByText('Active', { exact: true })).toHaveCount(0);
    await expect(surface(page).locator('.runtime-instance').getByText('Active', { exact: true })).toBeVisible();
    await expect(surface(page).getByRole('button', { name: 'Dead-letter jobs present: 1', exact: true })).toBeVisible();
    const secondTab = page.getByRole('tab', { name: /deskFailure/ }); await expect(secondTab).toBeVisible();
    await expect(page.locator('.document-tab[data-kind=monitor]')).toHaveCount(2);
    await firstTab.click(); await expect(surface(page).locator('.runtime-instance > code')).toHaveText(fixture.parallelInstanceId);
    await expect(surface(page).locator('.viewport')).toHaveAttribute('transform', transform!); expect(await node?.evaluate(element => element.isConnected)).toBe(true);
    await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click(); await createDiagram(page, 'Flowable');
    await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Retained draft'); await page.getByLabel('Name', { exact: true }).blur();
    await page.getByTitle('Manage connections', { exact: true }).click();
    await expect(page.getByRole('dialog').getByLabel('Connection name')).toHaveValue('Fixture engine');
    await page.getByRole('dialog').getByTitle('Close', { exact: true }).click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Retained draft');
    await page.getByRole('button', { name: 'XML', exact: true }).click(); await page.getByLabel('Diagram XML', { exact: true }).focus();
    await page.keyboard.press('Control+Home'); await page.keyboard.insertText('<!-- retained XML draft -->\n');
    await secondTab.click(); await expect(surface(page).locator('.runtime-instance > code')).toHaveText(fixture.failedInstanceId);
    await expect(page.getByTitle('Save (Ctrl+S)', { exact: true })).toHaveCount(0);
    await secondTab.locator('..').getByRole('button').click(); await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    const local = page.locator('.document-tab[data-kind=document]').getByRole('tab'); await local.click();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Retained draft'); await expect(page.getByLabel('Diagram XML', { exact: true })).toContainText('retained XML draft');
    page.once('dialog', dialog => void dialog.dismiss()); await local.locator('..').getByRole('button').click(); await expect(local).toBeVisible();
    await page.getByRole('button', { name: 'Discard XML edits', exact: true }).click(); await page.getByTitle('Undo (Ctrl+Z)', { exact: true }).click();
    await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);
    await local.locator('..').getByRole('button').click(); await expect(firstTab).toHaveAttribute('aria-selected', 'true');
    await page.locator('.new-tab').click();
    await page.getByTitle('Manage connections', { exact: true }).click();
    await expect(page.getByRole('dialog').getByLabel('Connection name')).toHaveValue('Fixture engine');
    await page.getByRole('dialog').getByTitle('Close', { exact: true }).click();
    await page.locator('.welcome').getByRole('button', { name: 'camunda7-showcase', exact: true }).click();
    await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
    await firstTab.click(); await expect(surface(page).locator('.runtime-instance > code')).toHaveText(fixture.parallelInstanceId);
  } finally { await close(app, directory); }
});

test('тестирование нового и изменённого подключения читает поля формы и ничего не сохраняет', async () => {
  const { app, page, directory } = await launch();
  try {
    await expect(page.getByTitle('Manage connections', { exact: true })).toHaveCount(1);
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await page.getByTitle('Manage connections', { exact: true }).click();
      await selectOption(page.getByRole('combobox', { name: 'Authentication', exact: true }), 'none');
      const form = page.locator('.connection-form');
      const save = await form.getByRole('button', { name: 'Save connection', exact: true }).boundingBox();
      const check = await form.getByRole('button', { name: 'Test connection', exact: true }).boundingBox();
      const remove = await form.getByTitle('Delete', { exact: true }).boundingBox();
      expect(save).not.toBeNull(); expect(check).not.toBeNull(); expect(remove).not.toBeNull();
      expect(Math.abs(save!.y + save!.height / 2 - check!.y - check!.height / 2)).toBeLessThan(1);
      expect(Math.abs(save!.y + save!.height / 2 - remove!.y - remove!.height / 2)).toBeLessThan(1);
      expect(remove!.x).toBeGreaterThan(check!.x + check!.width);
      await page.screenshot({ path: `test-results/connections-actions-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
      page.once('dialog', dialog => void dialog.dismiss()); await form.getByTitle('Delete', { exact: true }).click();
      await expect(form.getByTitle('Delete', { exact: true })).toBeEnabled();
      expect((await page.evaluate(() => window.runtime!.connections())).items).toHaveLength(1);
      await page.getByRole('dialog').getByTitle('Close', { exact: true }).click();
    }
    await page.getByTitle('Manage connections', { exact: true }).click(); await page.getByRole('button', { name: 'New connection', exact: true }).click();
    await expect(page.getByRole('dialog').getByTitle('Delete', { exact: true })).toHaveCount(0);
    await page.getByLabel('REST API URL').fill(fixture.baseUrl); await page.getByLabel('Username', { exact: true }).fill('desk-reader');
    await page.getByLabel('Password or token').fill('wrong-password'); await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('401');
    await page.getByLabel('Password or token').fill('fixture-password'); await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Connection verified');
    expect((await page.evaluate(() => window.runtime!.connections())).items).toHaveLength(1);
    const auth = page.getByRole('combobox', { name: 'Authentication', exact: true }); await auth.focus(); await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape'); await expect(page.getByRole('listbox')).toHaveCount(0); await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Fixture engine', exact: false }).click();
    await page.getByLabel('Password or token').fill('wrong-password'); await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('401');
    await page.getByLabel('Password or token').fill(''); await page.getByRole('button', { name: 'Test connection', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Connection verified'); await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0); await openInstance(page, fixture.reviewInstanceId);
    const transform = await surface(page).locator('.viewport').getAttribute('transform'); const canvas = await surface(page).locator('.djs-container').elementHandle();
    await page.getByTitle('Manage connections', { exact: true }).click(); await page.getByLabel('Password or token').fill('wrong-password');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(surface(page).locator('.runtime-catalog [role="alert"]')).toContainText('401');
    expect(await canvas?.evaluate(element => element.isConnected)).toBe(true);
    await page.getByTitle('Manage connections', { exact: true }).click(); await page.getByLabel('Password or token').fill('fixture-password');
    await page.getByRole('button', { name: 'Save connection', exact: true }).click();
    await expect(surface(page).locator('.runtime-catalog .runtime-row').first()).toBeVisible();
    await expect(surface(page).locator('.runtime-instance > code')).toHaveText(fixture.reviewInstanceId);
    await expect(surface(page).locator('.viewport')).toHaveAttribute('transform', transform!);
  } finally { await close(app, directory); }
});

test('фильтры каталога, metadata, переход к ребёнку и отсутствие горизонтального скролла', async () => {
  const { app, page, directory } = await launch();
  try {
    await openInstance(page, fixture.reviewInstanceId);
    await expect(surface(page).locator('.runtime-row').filter({ hasText: fixture.reviewInstanceId })).toContainText('deskReview');
    const filters = surface(page).locator('.catalog-filters'); await filters.locator('summary').click();
    await filters.getByLabel('Process key', { exact: true }).fill('deskParallel');
    await selectOption(filters.getByRole('combobox', { name: 'Page size', exact: true }), '10');
    await selectOption(filters.getByRole('combobox', { name: 'Order', exact: true }), 'desc');
    await filters.getByRole('button', { name: 'Apply filters', exact: true }).click();
    await expect(surface(page).locator('.runtime-row')).toHaveCount(1); await expect(surface(page).locator('.runtime-row')).toContainText('deskParallel');
    await openInstance(page, fixture.parentInstanceId);
    await surface(page).getByRole('button', { name: `Child instance: ${fixture.childInstanceId}`, exact: true }).click();
    await expect(surface(page).locator('.runtime-instance > code')).toHaveText(fixture.childInstanceId);
    await surface(page).getByRole('button', { name: `Parent instance: ${fixture.parentInstanceId}`, exact: true }).click();
    await expect(surface(page).locator('.runtime-instance > code')).toHaveText(fixture.parentInstanceId);
    await openInstance(page, fixture.reviewInstanceId);
    await filters.getByRole('button', { name: 'Reset filters', exact: true }).click();
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await page.setViewportSize({ width: 1050, height: 680 });
      await expect(surface(page).locator('.runtime-instance > strong')).toContainText('REVIEW:DOCUMENT:');
      for (const selector of ['.runtime-details', '.runtime-list', '.runtime-instance', '.runtime-catalog', '.toolbar']) {
        const target = selector === '.toolbar' ? page.locator(selector) : surface(page).locator(selector);
        expect(await target.evaluate(element => element.scrollWidth <= element.clientWidth + 1), selector).toBe(true);
      }
      await page.screenshot({ path: `test-results/runtime-compact-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
    }
    await expect(page.locator('select')).toHaveCount(0);
  } finally { await close(app, directory); }
});

test('выделение и фокус холста, центрирование бейджей, SVG и PNG с метками', async () => {
  const { app, page, directory } = await launch();
  try {
    await openInstance(page, fixture.parallelInstanceId);
    const task = surface(page).locator('.djs-element[data-element-id="ReviewMany"]'); await task.locator('.djs-hit').click();
    await expect(task).toHaveClass(/selected/); await expect(surface(page).locator('.runtime-selection')).toContainText('ReviewMany');
    const badge = surface(page).locator('.runtime-badge[data-activity-id="ReviewMany"]');
    expect(await badge.evaluate(element => { const style = getComputedStyle(element); return [style.display, style.alignItems, style.justifyContent, style.lineHeight]; })).toEqual(['inline-flex', 'center', 'center', '11px']);
    for (const theme of ['Light theme', 'Dark theme']) {
      await page.getByTitle(theme, { exact: true }).click(); await surface(page).locator('.djs-container > svg').focus();
      const colors = await surface(page).locator('.djs-container > svg').evaluate(element => ({ outline: getComputedStyle(element).outlineColor, accent: getComputedStyle(element).getPropertyValue('--accent').trim() }));
      const normalized = await page.evaluate(color => { const element = document.createElement('span'); element.style.color = color; document.body.append(element); const result = getComputedStyle(element).color; element.remove(); return result; }, colors.accent);
      expect(colors.outline).toBe(normalized); await expect(task).toHaveClass(/selected/);
    }
    const svgPath = resolve(directory, 'runtime.svg');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, svgPath);
    await page.getByTitle('Export SVG', { exact: true }).click();
    await expect(async () => { const svg = await readFile(svgPath, 'utf8'); expect(svg).toContain('data-runtime-badge="ReviewMany"'); expect(svg).toContain('>3</text>'); expect(svg).toContain('stroke="#228d72"'); expect(svg).not.toMatch(/var\(|djs-outline/); }).toPass();
    const pngPath = resolve(directory, 'runtime.png');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, pngPath);
    await page.getByTitle('Export format', { exact: true }).click(); await page.getByRole('menuitem', { name: 'PNG · white background', exact: true }).click();
    await expect(async () => { const png = await readFile(pngPath); expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); }).toPass();
    const pixels = await page.evaluate(async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data; let green = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 34 && pixels[i + 1] === 141 && pixels[i + 2] === 114) green++;
      return { corner: Array.from(pixels.slice(0, 4)), green };
    }, (await readFile(pngPath)).toString('base64'));
    expect(pixels.corner).toEqual([255, 255, 255, 255]); expect(pixels.green).toBeGreaterThan(100);
    expect(await page.evaluate(() => window.desktop!.recentFiles())).toEqual([]); await expect(page.locator('.dirty-dot')).toHaveCount(0);
  } finally { await close(app, directory); }
});
