import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { preservationIssues } from '../../src/renderer/bpmn/xml';
import { test, expect } from './russian-fixture';

async function select(page: Page, id: string) {
  await page.getByLabel('Найти элемент').fill(id);
  await page.locator('.outline-item').first().click();
}
async function download(page: Page) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  return pending;
}

test('connector, multi-instance, ошибки и message definitions редактируются в правильном target', async ({ page }) => {
  const source = readFileSync('examples/camunda7-integration.bpmn20.xml', 'utf8');
  await page.goto('/');
  await page.getByRole('button', { name: 'camunda7-integration', exact: true }).click();
  const baseline = await download(page);
  await baseline.saveAs('.cache/camunda-exports/camunda7-integration.bpmn20.xml');
  expect(preservationIssues(source, readFileSync((await baseline.path())!, 'utf8'))).toEqual([]);
  await select(page, 'ConnectorTask');
  const connector = page.locator('[data-extension-kind="connector"]');
  await connector.locator('summary').click();
  await connector.getByLabel('Текст · connectorId', { exact: true }).fill('custom-connector');
  await connector.getByLabel('Текст · connectorId', { exact: true }).blur();
  await select(page, 'BatchTask');
  const loop = page.locator('.engine-properties').filter({ hasText: 'MultiInstanceLoopCharacteristics' });
  await loop.getByLabel('Коллекция', { exact: true }).fill('updatedItems');
  await loop.getByLabel('Коллекция', { exact: true }).blur();
  await loop.getByLabel('Повторные попытки', { exact: true }).fill('R6/PT2M');
  await loop.getByLabel('Повторные попытки', { exact: true }).blur();
  await select(page, 'BatchError');
  await page.getByLabel('Переменная кода ошибки', { exact: true }).fill('updatedCode');
  await page.getByLabel('Переменная кода ошибки', { exact: true }).blur();
  await select(page, 'NotifyEnd');
  await page.getByLabel('Выражение делегата', { exact: true }).fill('${updatedNotification}');
  await page.getByLabel('Выражение делегата', { exact: true }).blur();
  const field = page.locator('[data-extension-target="bpmn:MessageEventDefinition"] [data-extension-kind="field"]');
  await field.locator('summary').click();
  await field.getByLabel('Значение поля', { exact: true }).fill('changed-channel');
  await field.getByLabel('Значение поля', { exact: true }).blur();
  await page.getByRole('button', { name: 'Определения', exact: true }).click();
  await page.getByLabel('camunda:errorMessage', { exact: true }).fill('Updated failure message');
  await page.getByLabel('camunda:errorMessage', { exact: true }).blur();
  await page.getByTitle('Закрыть определения').click();
  const edited = await download(page);
  await edited.saveAs('.cache/camunda-edits/integration.bpmn20.xml');
  // Ожидаемый XML строится из оригинала отдельно от bpmn-js.
  const expected = source.replace('http-connector', 'custom-connector').replace('c7:collection="items"', 'c7:collection="updatedItems"').replace('R4/PT1M', 'R6/PT2M').replace('c7:errorCodeVariable="failureCode"', 'c7:errorCodeVariable="updatedCode"').replace('${notificationWorker}', '${updatedNotification}').replace('<c7:field name="channel" stringValue="integration" />', '<c7:field name="channel"><c7:string>changed-channel</c7:string></c7:field>').replace('Batch processing failed', 'Updated failure message');
  mkdirSync('.cache/camunda-edits', { recursive: true });
  writeFileSync('.cache/camunda-edits/expected-integration.bpmn20.xml', expected);
});
