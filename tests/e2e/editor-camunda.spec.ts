import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { preservationIssues } from '../../src/renderer/bpmn/xml';
import { test, expect } from './russian-fixture';

const original = readFileSync('examples/camunda7-showcase.bpmn20.xml', 'utf8');
async function select(page: Page, id: string) {
  await page.getByLabel('Найти элемент').fill(id);
  await page.locator('.outline-item').first().click();
}
async function savedXml(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const path = await (await pending).path();
  return readFileSync(path!, 'utf8');
}
async function openXml(page: Page, xml: string) {
  const pending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Открыть', exact: true }).first().click();
  await (await pending).setFiles({ name: 'test.bpmn', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await expect(page.locator('.outline-item').first()).toBeVisible();
}

test('новые профили, автоматическое определение и восстановление Camunda 7', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Профиль новой схемы').selectOption('camunda7');
  await page.getByRole('button', { name: 'Новая схема', exact: true }).click();
  await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
  await expect(page.locator('[data-profile="flowable"]')).toHaveCount(0);
  await select(page, 'StartEvent_1');
  await page.getByLabel('Инициатор', { exact: true }).fill('starter');
  await page.getByLabel('Инициатор', { exact: true }).blur();
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.getByLabel('Инициатор', { exact: true })).toHaveValue('');
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
  await expect(page.getByLabel('Инициатор', { exact: true })).toHaveValue('starter');
  await page.reload();
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
  expect(await savedXml(page)).toContain('camunda:initiator="starter"');
  await page.getByLabel('Профиль новой схемы').selectOption('bpmn');
  await page.getByTitle('Новая схема (Ctrl+N)').click();
  await expect(page.locator('.document-workspace:visible [data-profile]')).toHaveCount(0);
  expect(await savedXml(page)).not.toContain('xmlns:camunda');
});

test('пример Camunda 7 сохраняет семантику и редактирует external task через undo/redo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'camunda7-showcase', exact: true }).click();
  await expect(page.locator('.djs-element[data-element-id="ArchiveOrder"]')).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const download = await pending;
  await download.saveAs('.cache/camunda-exports/camunda7-showcase.bpmn20.xml');
  expect(preservationIssues(original, readFileSync((await download.path())!, 'utf8'))).toEqual([]);
  await select(page, 'ArchiveOrder');
  await expect(page.getByLabel('Тип реализации', { exact: true })).toHaveValue('external');
  await expect(page.getByLabel('Последовательное выполнение заданий', { exact: true }).locator('..')).toHaveAttribute('data-presence', 'explicit');
  await page.getByLabel('Тема внешней задачи', { exact: true }).fill('archive-edited');
  await page.getByLabel('Тема внешней задачи', { exact: true }).blur();
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.getByLabel('Тема внешней задачи', { exact: true })).toHaveValue('archive-order');
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
  const xml = await savedXml(page);
  expect(xml).toContain('camunda:topic="archive-edited"');
  expect(preservationIssues(original, xml).every(issue => issue.includes('topic'))).toBe(true);
});

test('вложенные параметры, поля listener и formData сохраняют соседние расширения', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'camunda7-showcase', exact: true }).click();
  await select(page, 'ArchiveOrder');
  const parameters = page.locator('[data-extension-kind="inputOutput"]');
  await parameters.locator('summary').click();
  const entry = parameters.getByLabel('entry: key', { exact: true }).first();
  await entry.fill('editedOrderId'); await entry.blur();
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(entry).toHaveValue('orderId');
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
  await expect(entry).toHaveValue('editedOrderId');
  const listeners = page.locator('[data-extension-kind="executionListener"]');
  await listeners.locator('summary').click();
  await listeners.getByLabel('Значение поля', { exact: true }).fill('edited-category');
  await listeners.getByLabel('Значение поля', { exact: true }).blur();
  await select(page, 'ReviewOrder');
  const forms = page.locator('[data-extension-kind="formData"]');
  await forms.locator('summary').click();
  await forms.getByLabel('formField: label', { exact: true }).first().fill('Order approved');
  await forms.getByLabel('formField: label', { exact: true }).first().blur();
  await forms.getByRole('button', { name: 'Добавить formField', exact: true }).click();
  await expect(forms.getByLabel('formField: id', { exact: true })).toHaveCount(3);
  const xml = await savedXml(page);
  expect(xml).toContain('key="editedOrderId"');
  expect(xml).toContain('edited-category');
  expect(xml).toContain('label="Order approved"');
  expect(xml).toContain('demo:retention="standard"');
  expect(xml).toContain('name="Urgent"');
  expect(xml).toContain('camunda:failedJobRetryTimeCycle');
});

test('параметр переключается между текстом, map, list и script одной отменяемой командой', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'camunda7-showcase', exact: true }).click();
  await select(page, 'ArchiveOrder');
  const parameters = page.locator('[data-extension-kind="inputOutput"]');
  await parameters.locator('summary').click();
  const parameter = parameters.locator('[data-extension-path="0.1"]');
  await parameter.getByLabel('Тип значения', { exact: true }).selectOption('map');
  await parameter.getByRole('button', { name: 'Добавить entry', exact: true }).click();
  await parameter.getByLabel('Текст · entry', { exact: true }).fill('${computed}');
  await parameter.getByLabel('Текст · entry', { exact: true }).blur();
  await parameter.getByLabel('Тип значения', { exact: true }).first().selectOption('list');
  await expect(parameter.getByLabel('entry: key')).toHaveCount(0);
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(parameter.getByLabel('Текст · entry', { exact: true })).toHaveValue('${computed}');
  await parameter.getByLabel('Тип значения', { exact: true }).first().selectOption('script');
  await parameter.getByLabel('Текст · script', { exact: true }).fill('execution.getVariable("result")');
  await parameter.getByLabel('Текст · script', { exact: true }).blur();
  expect(await savedXml(page)).toContain('scriptFormat="javascript"');
});

test('альтернативный prefix и смешанные схемы редактируются без подмены namespace', async ({ page }) => {
  await page.goto('/');
  const source = original.replaceAll('camunda:', 'c7:').replace('xmlns:camunda=', 'xmlns:c7=').replace('xmlns:demo=', 'xmlns:flowable="http://flowable.org/bpmn" xmlns:demo=').replace('c7:exclusive="false"', 'c7:exclusive="false" flowable:async="true"');
  await openXml(page, source);
  await expect(page.locator('.engine-badge')).toHaveText('Flowable + Camunda 7');
  await select(page, 'ArchiveOrder');
  const camunda = page.getByRole('region', { name: 'Camunda 7', exact: true });
  await camunda.getByLabel('Повторные попытки', { exact: true }).fill('R5/PT1M');
  await camunda.getByLabel('Повторные попытки', { exact: true }).blur();
  const xml = await savedXml(page);
  expect(xml).toContain('<c7:failedJobRetryTimeCycle>R5/PT1M');
  expect(xml).toContain('flowable:async="true"');
  expect(xml).not.toContain('xmlns:camunda=');
  await page.getByRole('button', { name: 'Диагностика', exact: false }).click();
  await expect(page.locator('.diagnostics-panel')).toContainText('Смешанные расширения');
});
