import { test, expect } from './russian-fixture';
import { createDiagram } from './create-diagram';

test('полная отмена XML-правок не оставляет скрытый черновик после дальнейшей правки модели', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  const xml = page.getByLabel('XML схемы', { exact: true });
  await xml.fill('<unfinished'); await xml.press('Control+z');
  await expect(page.locator('.document-tab.active .unbound-dot')).toBeVisible();
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
  const name = page.getByLabel('Название', { exact: true });
  await name.fill('Правка после отмены XML'); await name.blur();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  expect((await download).suggestedFilename()).toContain('.bpmn');
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
});

for (const change of ['property', 'draft', 'applied-xml'] as const) {
  test(`дубликат с ${change} начинает собственную историю правок с серой точки`, async ({ page }) => {
    await page.goto('/'); await createDiagram(page, 'Flowable');
    if (change === 'property') {
      await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
      await page.getByLabel('Название', { exact: true }).fill('Изменённый источник');
      await page.getByLabel('Название', { exact: true }).blur();
    } else {
      await page.getByRole('button', { name: 'XML', exact: true }).click();
      const xml = page.getByLabel('XML схемы', { exact: true });
      await xml.fill((await xml.textContent())!.replace('name="Новый процесс"', 'name="Изменённый источник"'));
      if (change === 'applied-xml') {
        await page.getByRole('button', { name: 'Применить XML', exact: true }).click();
        await expect(page.locator('.toast')).toContainText('XML применён.');
      }
    }
    await page.locator('.document-tab.active').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Дублировать схему', exact: true }).click();
    const copy = page.locator('.document-tab.active');
    await expect(copy.locator('.unbound-dot')).toBeVisible();
    await expect(copy.locator('.dirty-dot.local')).toHaveCount(0);
    if (change === 'draft') {
      await page.getByRole('button', { name: 'XML', exact: true }).click();
      const xml = page.locator('.document-workspace:visible').getByLabel('XML схемы', { exact: true });
      await expect(xml).toContainText('Изменённый источник');
      await xml.fill('<another draft');
      await expect(copy.locator('.dirty-dot.local')).toBeVisible();
      await xml.press('Control+z');
      await expect(copy.locator('.unbound-dot')).toBeVisible();
      await xml.press('Control+y');
      await expect(copy.locator('.dirty-dot.local')).toBeVisible();
      await xml.press('Control+z');
    } else {
      await page.locator('.document-workspace:visible .outline-item').filter({ hasText: 'Process_1' }).click();
      const name = page.getByLabel('Название', { exact: true }).filter({ visible: true });
      await expect(name).toHaveValue('Изменённый источник');
      await name.fill('Изменённый дубликат'); await name.blur();
      await expect(copy.locator('.dirty-dot.local')).toBeVisible();
      await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
      await expect(copy.locator('.unbound-dot')).toBeVisible();
      await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
      await expect(copy.locator('.dirty-dot.local')).toBeVisible();
      await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
    }
    await expect(copy.locator('.unbound-dot')).toBeVisible();
    await page.reload(); await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
    await expect(page.locator('.document-tab.active .unbound-dot')).toBeVisible();
    await expect(page.locator('.document-tab').first().locator('.dirty-dot.local')).toBeVisible();
    page.once('dialog', dialog => dialog.dismiss());
    await page.locator('.document-tab.active').click({ button: 'middle' });
    await expect(page.locator('.document-tab')).toHaveCount(2);
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.document-tab.active').click({ button: 'middle' });
    await expect(page.locator('.document-tab')).toHaveCount(1);
  });
}
