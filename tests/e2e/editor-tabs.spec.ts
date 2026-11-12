import { test, expect } from './russian-fixture';
import { createDiagram } from './create-diagram';

test('схема без файла и её дубликат серые до правок, но закрытие требует подтверждения', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  const active = page.locator('.document-tab.active');
  await expect(active.locator('.unbound-dot')).toBeVisible();
  await active.getByRole('tab').hover();
  await expect(page.getByRole('tooltip')).toContainText('Схема не связана с файлом.');
  await active.click({ button: 'right' }); await page.getByRole('menuitem', { name: 'Дублировать схему', exact: true }).click();
  await expect(page.locator('.unbound-dot')).toHaveCount(2);
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).last().click();
  await page.getByLabel('Название', { exact: true }).filter({ visible: true }).fill('Изменённая копия');
  await page.getByLabel('Название', { exact: true }).filter({ visible: true }).blur();
  await expect(active.locator('.dirty-dot.local')).toBeVisible();
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(active.locator('.unbound-dot')).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss()); await active.click({ button: 'middle' });
  await expect(page.locator('.document-tab')).toHaveCount(2);
  page.once('dialog', dialog => dialog.accept()); await active.click({ button: 'middle' });
  await expect(page.locator('.document-tab')).toHaveCount(1);
  page.once('dialog', dialog => dialog.dismiss()); await active.click({ button: 'middle' });
  await expect(page.locator('.document-tab')).toHaveCount(1);
});

test('колёсико прокручивает вкладки без Shift, стрелки не меняют геометрию у краёв', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 }); await page.goto('/');
  for (let index = 0; index < 5; index++) {
    if (index) await page.locator('.new-tab').click();
    await createDiagram(page, 'Flowable');
  }
  const scroller = page.locator('.document-tabs'); const plus = page.locator('.new-tab');
  const width = await scroller.evaluate(element => element.clientWidth); const plusX = (await plus.boundingBox())!.x;
  const offset = () => scroller.evaluate(element => element.scrollLeft);
  const left = page.getByRole('button', { name: 'Прокрутить вкладки влево' });
  const right = page.getByRole('button', { name: 'Прокрутить вкладки вправо' });
  await scroller.hover(); await page.mouse.wheel(0, -1000); await expect.poll(offset).toBe(0);
  await expect(left).toBeHidden(); await expect(right).toBeVisible();
  expect(await scroller.evaluate(element => element.clientWidth)).toBe(width);
  expect((await plus.boundingBox())!.x).toBe(plusX);
  await page.mouse.wheel(0, 90); await expect.poll(offset).toBeGreaterThan(0);
  await right.hover(); await page.mouse.wheel(0, 1000); await expect(right).toBeHidden();
  expect(await scroller.evaluate(element => element.clientWidth)).toBe(width);
  expect((await plus.boundingBox())!.x).toBe(plusX);
  await scroller.hover(); await page.mouse.wheel(-1000, 0); await expect.poll(offset).toBe(0);
  await page.keyboard.down('Shift'); await page.mouse.wheel(0, 90); await page.keyboard.up('Shift');
  await expect.poll(offset).toBeGreaterThan(0);
  await page.setViewportSize({ width: 1800, height: 900 });
  await expect(left).toBeHidden(); await expect(right).toBeHidden();
  const last = (await page.locator('.document-tab').last().boundingBox())!;
  expect(Math.abs((await plus.boundingBox())!.x - last.x - last.width)).toBeLessThan(2);
});

test('средняя кнопка закрывает вкладку с обычным подтверждением несохранённых изменений', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Несохранённый процесс');
  await page.getByLabel('Название', { exact: true }).blur(); await page.locator('.new-tab').click();
  const document = page.locator('.document-tab[data-kind="document"]');
  page.once('dialog', dialog => { expect(dialog.message()).toContain('несохранённые изменения'); void dialog.dismiss(); });
  await document.click({ button: 'middle' }); await expect(page.getByRole('tab')).toHaveCount(2);
  page.once('dialog', dialog => { void dialog.accept(); });
  await document.click({ button: 'middle' }); await expect(document).toHaveCount(0);
  await expect(page.getByRole('tab')).toHaveCount(1); await expect(page.locator('.welcome')).toBeVisible();
  await page.getByRole('tab').click({ button: 'middle' }); await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(page.locator('.welcome')).toBeVisible();
});

test('переполненные вкладки прокручиваются стрелками, плюс остаётся доступным, активная вкладка видна', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 }); await page.goto('/');
  for (let index = 0; index < 5; index++) {
    if (index) await page.locator('.new-tab').click();
    await createDiagram(page, 'Flowable');
  }
  const strip = page.locator('.tab-strip');
  await expect(strip.getByRole('button', { name: 'Прокрутить вкладки влево' })).toBeVisible();
  await expect(strip.getByRole('button', { name: 'Прокрутить вкладки вправо' })).toBeHidden();
  await expect(page.locator('.new-tab')).toBeInViewport();
  const left = strip.getByRole('button', { name: 'Прокрутить вкладки влево' });
  const right = strip.getByRole('button', { name: 'Прокрутить вкладки вправо' });
  const scroller = page.locator('.document-tabs'); const initial = await scroller.evaluate(element => element.scrollLeft);
  await left.click(); await expect.poll(() => scroller.evaluate(element => element.scrollLeft)).toBeLessThan(initial);
  await expect(right).toBeVisible(); await right.click(); await expect(right).toBeHidden();
  await page.getByRole('tab').last().focus(); await page.keyboard.press('Home');
  await expect(page.getByRole('tab').first()).toBeFocused(); await expect(page.getByRole('tab').first()).toBeInViewport();
  await expect(left).toBeHidden(); await page.keyboard.press('End');
  await expect(page.getByRole('tab').last()).toBeFocused();
  await expect(page.getByRole('tab').last()).toBeInViewport();
  expect(await page.locator('.document-tabs').evaluate(element => getComputedStyle(element).scrollbarWidth)).toBe('none');
});

test('перетаскивание и клавиатурная перестановка сохраняют активную вкладку, модель и undo', async ({ page }) => {
  await page.goto('/'); await createDiagram(page, 'Flowable');
  await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Переставляемый процесс');
  await page.getByLabel('Название', { exact: true }).blur();
  await page.locator('.new-tab').click(); await createDiagram(page, 'BPMN 2.0');
  await page.locator('.new-tab').click();
  const tabs = page.getByRole('tab');
  const ids = await tabs.evaluateAll(elements => elements.map(element => element.getAttribute('data-tab-id')));
  const first = page.locator(`[data-tab-id="${ids[0]}"]`); const last = page.locator(`[data-tab-id="${ids[2]}"]`);
  const bounds = (await last.boundingBox())!;
  await first.dragTo(last, { targetPosition: { x: bounds.width - 5, y: bounds.height / 2 } });
  await expect(first).toHaveAttribute('draggable', 'true');
  expect(await tabs.evaluateAll(elements => elements.map(element => element.getAttribute('data-tab-id')))).toEqual([ids[1], ids[2], ids[0]]);
  await expect(last).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('.welcome')).toBeVisible();
  await first.click(); await expect(page.getByLabel('Название', { exact: true }).filter({ visible: true })).toHaveValue('Переставляемый процесс');
  await first.focus(); await page.keyboard.press('Control+Shift+ArrowLeft');
  expect(await tabs.evaluateAll(elements => elements.map(element => element.getAttribute('data-tab-id')))).toEqual([ids[1], ids[0], ids[2]]);
  await expect(first).toBeFocused(); await expect(first).toHaveAttribute('aria-selected', 'true');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.getByLabel('Название', { exact: true }).filter({ visible: true })).toHaveValue('Новый процесс');
  await first.click(); await page.keyboard.press('ArrowRight'); await expect(last).toBeFocused();
  await expect(page.locator('.welcome')).toBeVisible();
  await page.getByTitle('Закрыть Новая вкладка', { exact: true }).click();
  await expect(first).toHaveAttribute('aria-selected', 'true');
});
