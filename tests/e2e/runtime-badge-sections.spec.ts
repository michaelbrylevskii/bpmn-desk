import { expect, test } from '@playwright/test';
import { copyFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { launch, close, openInstance } from './runtime-fixture';
import { historyServer } from './history-server';

test('история, runtime и ошибки сохраняют отдельные секции и зубчатые границы на холсте и в экспорте', async () => {
  const api = await historyServer(); Object.assign(api.state, { summaryHistoryCount: 6, summaryHistoryTotal: 6000, summaryCount: 3, summaryTotal: 1000, summaryJobCount: 1, runtimeJobCount: 1, runtimeStatus: 200, finished: false, unfinishedActivities: true });
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await page.locator('.runtime-row').click();
    const badge = page.locator('.runtime-badge[data-activity-id="HistoryReview"]');
    await expect(badge).toHaveText('◷ 2+ · ● 3+ · ! 1');
    const sections = badge.locator('.runtime-badge-section');
    expect(await sections.evaluateAll(elements => elements.map(element => element.getAttribute('data-source')))).toEqual(['history', 'runtime', 'failed']);
    expect(await sections.evaluateAll(elements => elements.map(element => getComputedStyle(element).backgroundColor))).toEqual(['rgb(98, 107, 121)', 'rgb(32, 127, 103)', 'rgb(180, 35, 58)']);
    expect(await sections.evaluateAll(elements => elements.map(element => getComputedStyle(element).clipPath !== 'none'))).toEqual([true, true, false]);
    for (const width of [1500, 1050]) {
      await page.setViewportSize({ width, height: 720 }); await page.getByTitle('Fit diagram', { exact: true }).click();
      for (const theme of ['Light theme', 'Dark theme']) {
        await page.getByTitle(theme, { exact: true }).click();
        await expect(badge).toBeVisible(); await page.screenshot({ path: `test-results/badge-sections-${width}-${theme.startsWith('Light') ? 'light' : 'dark'}.png` });
      }
    }
    const filePath = resolve(directory, 'sections.svg');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, filePath);
    await page.getByTitle('Export SVG', { exact: true }).click();
    await expect(async () => {
      const svg = await readFile(filePath, 'utf8'); expect(svg).toContain('<title>◷ 2+ · ● 3+ · ! 1</title>');
      for (const color of ['#626b79', '#207f67', '#b4233a']) expect(svg).toContain(`fill="${color}"`);
      expect(svg).toContain('<polygon'); expect(svg).toContain('clip-path="url(#desk-badge-clip-');
    }).toPass();
    const pngPath = resolve(directory, 'sections.png');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, pngPath);
    await page.getByTitle('Export format', { exact: true }).click(); await page.getByRole('menuitem', { name: 'PNG · white background', exact: true }).click();
    await expect(async () => { expect((await readFile(pngPath)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a'); }).toPass();
    const colors = await page.evaluate(async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data; const counts = [0, 0, 0];
      for (let i = 0; i < pixels.length; i += 4) {
        for (const [index, rgb] of [[98, 107, 121], [32, 127, 103], [180, 35, 58]].entries()) if (rgb.every((value, channel) => pixels[i + channel] === value)) counts[index] = counts[index]! + 1;
      }
      return counts;
    }, (await readFile(pngPath)).toString('base64'));
    expect(colors.every(count => count > 10)).toBe(true); await copyFile(pngPath, 'test-results/badge-sections-export.png');
    await page.locator('.runtime-canvas [data-element-id="HistoryReview"] .djs-hit').click();
    await openInstance(page, 'p1'); await expect(badge).toHaveText('✓ 1 · ● 1 · ! 1');
    expect(await sections.evaluateAll(elements => elements.map(element => element.getAttribute('data-source')))).toEqual(['history', 'runtime', 'failed']);
    await page.screenshot({ path: 'test-results/badge-sections-instance.png' });
    for (let i = 0; i < 5 && (await badge.boundingBox())!.width < 180; i++) {
      const box = (await badge.boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.keyboard.down('Control');
      try { await page.mouse.wheel(0, -500); await expect.poll(async () => (await badge.boundingBox())!.width).toBeGreaterThan(box.width); }
      finally { await page.keyboard.up('Control'); }
    }
    await badge.screenshot({ path: 'test-results/badge-sections-detail.png' });

  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
