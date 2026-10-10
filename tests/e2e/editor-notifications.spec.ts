import { selectOption } from './select';
import { test, expect } from '@playwright/test';
import { emptyDiagram } from '../../src/renderer/bpmn/template';

test.beforeEach(async ({ page }) => {
  const now = new Date('2030-01-01T12:00:00Z');
  await page.clock.install({ time: now }); await page.clock.pauseAt(now);
});

for (const kind of ['malformed', 'body-text'] as const) {
  test(`${kind}: применение XML явно сообщает об отказе, сохраняет черновик, модель и undo`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'New tab', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
    await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
    await page.getByLabel('Name', { exact: true }).fill('Retained name');
    await page.getByLabel('Name', { exact: true }).blur();
    await page.getByRole('button', { name: 'XML', exact: true }).click();
    const xml = page.getByLabel('Diagram XML', { exact: true });
    const invalid = kind === 'malformed' ? '<broken>' : emptyDiagram.replace('<bpmn:process', 'dfsdvddsv\n  <bpmn:process');
    await xml.fill(invalid);
    await page.getByRole('button', { name: 'Apply XML', exact: true }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toHaveAttribute('data-severity', 'error');
    await expect(alert.locator('strong')).toHaveText('Could not apply XML.');
    await expect(alert.locator('p')).toContainText('Changes were not applied.');
    await expect(alert.locator('p')).not.toContainText('unparsable');
    await expect(alert.locator('pre')).toBeHidden();
    expect(await xml.locator('.cm-line').allTextContents()).toEqual(invalid.split('\n'));
    if (kind === 'body-text') await page.screenshot({ path: '.cache/notification-error-preview.png' });
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Retained name');
    await alert.getByText('Technical details', { exact: true }).click();
    await expect(alert.locator('pre')).toBeVisible();
    if (kind === 'body-text') {
      await expect(alert.locator('pre')).toContainText('dfsdvddsv');
      await expect(alert.locator('pre')).toContainText('line:');
      await expect(alert.locator('pre')).not.toContainText('Import may change data');
      await page.screenshot({ path: '.cache/notification-error-details-preview.png' });
    } else await expect(alert.locator('pre')).toContainText('Invalid XML');
    await selectOption(page.getByRole('combobox', { name: 'Language', exact: true }), 'ru');
    await expect(alert.locator('strong')).toHaveText('Не удалось применить XML.');
    await expect(alert.getByText('Технические подробности', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Отменить правки XML', exact: true }).click();
    await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
    await expect(page.getByLabel('Название', { exact: true })).toHaveValue('New process');
    await expect(page.getByLabel('Несохранённые изменения')).toHaveCount(0);
    await alert.getByTitle('Закрыть уведомление', { exact: true }).click();
    await expect(alert).toHaveCount(0);
  });
}

test('ошибка XML расширений выделяется в обеих темах и не заменяет модель', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await page.getByRole('textbox', { name: 'Find element' }).fill('prepareDocument');
  await page.locator('.outline-item').first().click();
  await page.getByText('Extension XML', { exact: true }).click();
  const xml = page.getByLabel('Extension XML', { exact: true });
  await xml.fill('<broken>');
  await page.getByRole('button', { name: 'Apply extensions', exact: true }).click();
  const alert = page.getByRole('alert');
  await expect(alert.locator('strong')).toHaveText('Could not apply extension XML.');
  for (const name of ['Light theme', 'Dark theme']) {
    await page.getByRole('button', { name, exact: true }).click();
    const colors = await alert.evaluate(element => {
      const css = getComputedStyle(element);
      return { border: css.borderColor, background: css.backgroundColor, icon: getComputedStyle(element.querySelector('.toast-icon')!).color };
    });
    expect(colors.border).toBe(name === 'Light theme' ? 'rgb(180, 35, 58)' : 'rgb(242, 163, 169)');
    expect(colors.icon).toBe(colors.border);
    expect(colors.background).toBe(name === 'Light theme' ? 'rgb(255, 242, 243)' : 'rgb(45, 30, 41)');
  }
  await expect(xml).toHaveText('<broken>');
  await expect(page.getByLabel('Unsaved changes')).toHaveCount(0);
});

test('успешное применение автоматически исчезает после плавного затухания', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'BPMN 2.0', exact: true }).click();
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  await page.getByRole('button', { name: 'Apply XML', exact: true }).click();
  const notice = page.getByRole('status');
  await expect(notice).toHaveAttribute('data-severity', 'success');
  await page.clock.runFor(4800);
  await expect(notice).toHaveAttribute('data-fading', 'true');
  await page.clock.runFor(200);
  await expect(notice).toHaveCount(0);
});

test('наведение останавливает затухание, уход курсора возобновляет его с дебаунсом', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  await page.getByLabel('Diagram XML', { exact: true }).fill('<broken>');
  await page.getByRole('button', { name: 'Apply XML', exact: true }).click();
  const alert = page.getByRole('alert');
  await page.clock.runFor(11800);
  await expect(alert).toHaveAttribute('data-fading', 'true');
  await alert.hover();
  await expect(alert).toHaveAttribute('data-fading', 'false');
  await page.clock.runFor(20000);
  await expect(alert).toBeVisible();
  await page.getByRole('button', { name: 'Apply XML', exact: true }).hover();
  await page.clock.runFor(1000);
  await expect(alert).toHaveAttribute('data-fading', 'false');
  await alert.hover(); // Повторное наведение сбрасывает ожидание возобновления.
  await page.getByRole('button', { name: 'Apply XML', exact: true }).hover();
  await page.clock.runFor(1400);
  await expect(alert).toHaveAttribute('data-fading', 'false');
  await page.clock.runFor(100);
  await expect(alert).toHaveAttribute('data-fading', 'true');
  await page.clock.runFor(200);
  await expect(alert).toHaveCount(0);
});

test('подробности и клавиатурный фокус удерживают уведомление, повторная ошибка обновляет таймер', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  await page.getByLabel('Diagram XML', { exact: true }).fill('<broken>');
  const apply = page.getByRole('button', { name: 'Apply XML', exact: true });
  await apply.click();
  const alert = page.getByRole('alert');
  await alert.getByTitle('Dismiss notification', { exact: true }).focus();
  await page.clock.runFor(15000);
  await expect(alert).toBeVisible();
  await alert.getByText('Technical details', { exact: true }).click();
  await apply.focus(); await apply.hover();
  await page.clock.runFor(15000);
  await expect(alert.locator('pre')).toBeVisible();
  await apply.click();
  await expect(alert.locator('pre')).toBeHidden();
  await page.clock.runFor(11000);
  await expect(alert).toBeVisible();
  await apply.click();
  await page.clock.runFor(11000);
  await expect(alert).toBeVisible();
  await page.clock.runFor(1000);
  await expect(alert).toHaveCount(0);
});
