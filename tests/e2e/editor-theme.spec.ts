import { test, expect } from './russian-fixture';
import { readFileSync } from 'node:fs';

test('тема холста меняется без изменения XML, экспорт SVG содержит готовые цвета', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая схема', exact: true }).click();
  const circle = page.locator('[data-element-id="StartEvent_1"] .djs-visual circle').first();
  await expect(circle).toBeVisible();
  const darkFill = await circle.evaluate(el => getComputedStyle(el).fill);
  expect(darkFill).not.toBe('rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  const xml = await page.getByLabel('XML схемы').textContent();
  const syntax = page.locator('.xml-panel').getByText('"Process_1"', { exact: true }).first();
  expect(await syntax.evaluate(el => getComputedStyle(el).color)).not.toBe('rgb(170, 17, 17)');
  await page.getByTitle('Светлая тема', { exact: true }).click();
  expect(await circle.evaluate(el => getComputedStyle(el).fill)).toBe('rgb(255, 255, 255)');
  await expect(page.getByLabel('XML схемы')).toHaveText(xml!);
  await expect(page.getByLabel('Несохранённые изменения')).toHaveCount(0);
  const pending = page.waitForEvent('download');
  await page.getByTitle('Экспорт SVG', { exact: true }).click();
  const svg = readFileSync((await (await pending).path())!, 'utf8');
  expect(svg).not.toContain('var(--diagram');
  expect(svg).toContain('#ffffff');
});


test('явные цвета DI сохраняются, светлая заливка получает читаемую подпись в тёмной теме', async ({ page }) => {
  const { emptyDiagram } = await import('../../src/renderer/bpmn/template');
  const xml = emptyDiagram.replace('<bpmn:definitions ', '<bpmn:definitions xmlns:bioc="http://bpmn.io/schema/bpmn/biocolor/1.0" ')
    .replace('<bpmndi:BPMNShape ', '<bpmndi:BPMNShape bioc:fill="#ffffff" bioc:stroke="#263244" ');
  await page.goto('/');
  const pending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Открыть', exact: true }).first().click();
  await (await pending).setFiles({ name: 'colors.bpmn', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  const circle = page.locator('[data-element-id="StartEvent_1"] .djs-visual circle').first();
  await expect(circle).toBeVisible();
  expect(await circle.evaluate(el => getComputedStyle(el).fill)).toBe('rgb(255, 255, 255)');
  const label = page.locator('[data-element-id="StartEvent_1_label"] text');
  await expect(label).toBeVisible();
  expect(await label.evaluate(el => getComputedStyle(el).fill)).toBe('rgb(23, 33, 56)');
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  expect(readFileSync((await (await saved).path())!, 'utf8')).toContain('bioc:fill="#ffffff"');
});
