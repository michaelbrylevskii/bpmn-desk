import { test, expect } from './russian-fixture';
import { readFileSync } from 'node:fs';
import { preservationIssues } from '../../src/renderer/bpmn/xml';

test('размещение граничных событий исправляется одной отменяемой командой', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'flowable-boundary-events', exact: true }).click();
  await page.getByRole('textbox', { name: 'Найти элемент' }).fill('Review document');
  await page.locator('.outline-item').filter({ hasText: 'reviewCall' }).click();
  const event = page.locator('.djs-shape[data-element-id="reviewErrorBoundary"]');
  const original = await event.getAttribute('transform');
  await page.getByRole('button', { name: 'Разнести события', exact: true }).click();
  await expect(event).not.toHaveAttribute('transform', original!);
  await expect(page.locator('.layout-notice')).toHaveCount(0);
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const xml = readFileSync((await (await pending).path())!, 'utf8');
  expect(xml).toContain('attachedToRef="reviewCall"');
  expect(preservationIssues(readFileSync('examples/flowable-boundary-events.bpmn20.xml', 'utf8'), xml)).toEqual([]);
  await (await pending).saveAs('.cache/flowable-layout/flowable-boundary-events.bpmn20.xml');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(event).toHaveAttribute('transform', original!);
  await expect(page.locator('.layout-notice')).toBeVisible();
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
  await expect(page.locator('.layout-notice')).toHaveCount(0);
});
