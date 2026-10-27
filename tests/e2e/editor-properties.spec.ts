import { selectOption } from './select';
import { readFileSync } from 'node:fs';
import { requireBpmn } from '../../src/renderer/bpmn/xml';
import { test, expect } from './russian-fixture';

test('свойства отличают заданное false от значения по умолчанию', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'flowable-boundary-events', exact: true }).click();
  await page.getByRole('textbox', { name: 'Найти элемент' }).fill('Review document');
  await page.locator('.outline-item').filter({ hasText: 'reviewCall' }).click();
  await expect(page.locator('.property-legend, .field-status')).toHaveCount(0);
  const field = page.getByLabel('isForCompensation', { exact: true });
  await expect(field).toHaveAttribute('data-value', '');
  await expect(field.locator('xpath=ancestor::label')).toHaveAttribute('data-presence', 'default');
  await selectOption(field, 'false');
  await expect(field.locator('xpath=ancestor::label')).toHaveAttribute('data-presence', 'explicit');
  await expect(field).toHaveAttribute('data-value', 'false');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(field.locator('xpath=ancestor::label')).toHaveAttribute('data-presence', 'default');
  expect(await page.getByLabel('Название', { exact: true }).locator('..').locator('span').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBe(11);
  const call = page.getByLabel('calledElement', { exact: true });
  await expect(call.locator('..')).toHaveAttribute('data-presence', 'explicit');
  await expect(page.getByLabel('Название', { exact: true }).locator('..')).toHaveAttribute('data-presence', 'explicit');
});

test('поток по умолчанию назначается со стрелки и узла, заменяется и отменяется', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'flowable-vacation-approval', exact: true }).click();
  const select = async (id: string) => {
    await page.getByLabel('Найти элемент').fill(id); await page.locator('.outline-item').filter({ hasText: id }).click();
  };
  const saveDefault = async () => {
    const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const document = requireBpmn(readFileSync((await (await pending).path())!, 'utf8'));
    const gateway = Array.from(document.getElementsByTagName('*')).find(element => element.getAttribute('id') === 'requestApprovedDecision');
    expect(document.getElementsByTagNameNS('http://flowable.org/bpmn', 'is-default-flow')).toHaveLength(0);
    return gateway?.getAttribute('default') ?? '';
  };
  await select('flow1'); await expect(page.getByLabel('Поток по умолчанию', { exact: true })).toHaveCount(0);
  await select('flow3'); const field = page.getByLabel('Поток по умолчанию', { exact: true });
  await expect(field).toHaveAttribute('data-value', 'false'); await selectOption(field, 'true');
  expect(await saveDefault()).toBe('flow3');
  await select('requestApprovedDecision'); await expect(page.getByLabel('default', { exact: true })).toHaveAttribute('data-value', 'flow3');
  await select('flow5'); await selectOption(field, 'true'); expect(await saveDefault()).toBe('flow5');
  await select('flow3'); await expect(field).toHaveAttribute('data-value', 'false');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click(); await expect(field).toHaveAttribute('data-value', 'true');
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click(); await expect(field).toHaveAttribute('data-value', 'false');
  await select('flow5'); await selectOption(field, 'false'); expect(await saveDefault()).toBe('');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click(); await expect(field).toHaveAttribute('data-value', 'true');
  await select('requestApprovedDecision'); await selectOption(page.getByLabel('default', { exact: true }), 'flow3');
  await select('flow3'); await expect(field).toHaveAttribute('data-value', 'true');
  await select('flow2'); await expect(field).toHaveAttribute('data-value', 'false');
  await selectOption(field, 'true'); await select('processVacationRequest');
  await expect(page.getByLabel('default', { exact: true })).toHaveAttribute('data-value', 'flow2');
});
