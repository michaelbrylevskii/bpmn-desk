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
      await page.locator('.properties details').filter({ has: page.getByRole('button', { name: 'Добавить executionListener', exact: true }) }).locator('summary').click();
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
