import { readFileSync } from 'node:fs';
import { test, expect } from './russian-fixture';

test('экспорт PNG поддерживает белый и прозрачный фон, не меняет XML и dirty state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await page.getByLabel('Найти элемент').fill('prepareDocument');
  await page.locator('.outline-item').first().click();
  await page.getByLabel('Выражение делегата', { exact: true }).fill('${exportedDelegate}');
  await page.getByLabel('Выражение делегата', { exact: true }).blur();
  await expect(page.locator('.dirty-dot')).toBeVisible();
  const pngDimensions: number[][] = [];
  for (const [option, pixel] of [['PNG · белый фон', [255, 255, 255, 255]], ['PNG · прозрачный фон', [0, 0, 0, 0]]] as const) {
    await page.getByTitle('Формат экспорта', { exact: true }).click();
    const pending = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: option, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe('flowable-showcase.png');
    const bytes = readFileSync((await download.path())!);
    expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const image = await page.evaluate(async data => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0);
      const pixel = Array.from(context.getImageData(0, 0, 1, 1).data);
      const dimensions = [bitmap.width, bitmap.height]; bitmap.close();
      return { pixel, dimensions };
    }, Array.from(bytes));
    expect(image.pixel).toEqual(pixel);
    expect(image.dimensions[0]).toBeGreaterThan(1000);
    pngDimensions.push(image.dimensions);
    await expect(page.locator('.dirty-dot')).toBeVisible();
    await expect(page.getByLabel('Выражение делегата', { exact: true })).toHaveValue('${exportedDelegate}');
  }
  expect(pngDimensions[0]).toEqual(pngDimensions[1]);
  await page.getByTitle('Формат экспорта', { exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  const pending = page.waitForEvent('download');
  await page.getByTitle('PNG · прозрачный фон', { exact: true }).click();
  expect((await pending).suggestedFilename()).toBe('flowable-showcase.png');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
});
