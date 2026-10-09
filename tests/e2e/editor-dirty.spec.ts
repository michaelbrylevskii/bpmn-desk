import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { canonicalElement, requireBpmn } from '../../src/renderer/bpmn/xml';
import { test, expect } from './russian-fixture';

for (const scenario of [
  { kind: 'property', sample: 'flowable-showcase', id: 'prepareDocument' },
  { kind: 'extension', sample: 'flowable-showcase', id: 'prepareDocument' },
  { kind: 'property', sample: 'camunda7-showcase', id: 'ArchiveOrder' },
  { kind: 'extension', sample: 'camunda7-showcase', id: 'ArchiveOrder' },
]) {
  test(`${scenario.sample}: полная отмена ${scenario.kind} возвращает чистое состояние`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: scenario.sample, exact: true }).click();
    await page.getByLabel('Найти элемент').fill(scenario.id);
    await page.locator('.outline-item').first().click();
    let pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const before = readFileSync((await (await pending).path())!, 'utf8');
    if (scenario.kind === 'property') {
      await page.getByLabel('Название', { exact: true }).fill('Changed name');
      await page.getByLabel('Название', { exact: true }).blur();
    } else {
      await page.locator('.properties summary').filter({ hasText: 'executionListener' }).click();
      await page.getByRole('button', { name: 'Добавить executionListener', exact: true }).click();
    }
    await expect(page.locator('.dirty-dot')).toBeVisible();
    await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
    // Скачиваем XML после undo для независимого сравнения, перед сохранением фиксируем индикатор.
    await expect(page.getByTitle('Отменить (Ctrl+Z)', { exact: true })).toBeDisabled();
    const dirty = await page.locator('.dirty-dot').count();
    pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const after = readFileSync((await (await pending).path())!, 'utf8');
    mkdirSync('.cache/dirty-check', { recursive: true });
    writeFileSync(`.cache/dirty-check/${scenario.sample}-${scenario.kind}-before.xml`, before);
    writeFileSync(`.cache/dirty-check/${scenario.sample}-${scenario.kind}-after.xml`, after);
    expect(canonicalElement(requireBpmn(after).documentElement) === canonicalElement(requireBpmn(before).documentElement), 'Undo должен восстановить также BPMN DI').toBe(true);
    expect(dirty).toBe(0);
  });
}

test('undo/redo названия сохраняет существующие границы и стиль внешней подписи', async ({ page }) => {
  const { emptyDiagram } = await import('../../src/renderer/bpmn/template');
  const xml = emptyDiagram.replace('</bpmndi:BPMNShape>', '<bpmndi:BPMNLabel labelStyle="LabelStyle_1"><dc:Bounds x="210" y="240" width="100" height="24" /></bpmndi:BPMNLabel></bpmndi:BPMNShape>')
    .replace('</bpmndi:BPMNDiagram>', '<bpmndi:BPMNLabelStyle id="LabelStyle_1"><dc:Font name="Arial" size="12" isBold="true" /></bpmndi:BPMNLabelStyle></bpmndi:BPMNDiagram>');
  await page.goto('/');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Открыть', exact: true }).first().click();
  await (await chooser).setFiles({ name: 'label.bpmn', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await page.locator('.outline-item').filter({ hasText: 'StartEvent_1' }).click();
  let pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const before = readFileSync((await (await pending).path())!, 'utf8');
  await page.getByLabel('Название', { exact: true }).fill('Changed label');
  await page.getByLabel('Название', { exact: true }).blur();
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
  await expect(page.locator('.dirty-dot')).toBeVisible();
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.locator('.dirty-dot')).toHaveCount(0);
  pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const after = readFileSync((await (await pending).path())!, 'utf8');
  expect(canonicalElement(requireBpmn(after).documentElement) === canonicalElement(requireBpmn(before).documentElement)).toBe(true);
});
