import { readFileSync } from 'node:fs';
import { canonicalElement, preservationIssues, requireBpmn } from '../../src/renderer/bpmn/xml';
import { test, expect } from './russian-fixture';

for (const scenario of [
  { sample: 'camunda7-showcase', id: 'ArchiveOrder', uri: 'http://camunda.org/schema/1.0/bpmn', attribute: 'topic', value: 'archive-order' },
  { sample: 'flowable-showcase', id: 'prepareDocument', uri: 'http://flowable.org/bpmn', attribute: 'delegateExpression', value: '${prepareDocumentDelegate}' },
]) {
  test(`${scenario.sample}: смена типа задачи сохраняет расширения и отменяется`, async ({ page }) => {
    const source = readFileSync(`examples/${scenario.sample}.bpmn20.xml`, 'utf8');
    await page.goto('/');
    await page.getByRole('button', { name: scenario.sample, exact: true }).click();
    await page.getByLabel('Найти элемент').fill(scenario.id);
    await page.locator('.outline-item').first().click();
    await page.locator('.djs-context-pad [data-action="replace"]').click();
    await page.locator('.djs-popup [data-id="replace-with-send-task"]').click();
    await expect(page.locator('.properties .badge').first()).toHaveText('SendTask');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const xml = readFileSync((await (await pending).path())!, 'utf8');
    const task = Array.from(requireBpmn(xml).getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'sendTask')).find(element => element.getAttribute('id') === scenario.id);
    expect(task?.getAttributeNS(scenario.uri, scenario.attribute)).toBe(scenario.value);
    expect(preservationIssues(source, xml)).toEqual([]);
    await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
    await page.locator('.outline-item').first().click();
    await expect(page.locator('.properties .badge').first()).toHaveText('ServiceTask');
    const undo = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    expect(preservationIssues(source, readFileSync((await (await undo).path())!, 'utf8'))).toEqual([]);
  });
  test(`${scenario.sample}: copy/paste клонирует расширения независимо от оригинала`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: scenario.sample, exact: true }).click();
    await page.getByLabel('Найти элемент').fill(scenario.id);
    await page.locator('.outline-item').first().click();
    await expect(page.locator(`.djs-shape.selected[data-element-id="${scenario.id}"]`)).toBeVisible();
    const canvas = page.locator('.bpmn-container .djs-container > svg');
    await canvas.focus();
    await page.keyboard.press('Control+c');
    await page.keyboard.press('Control+v');
    const bounds = await canvas.boundingBox();
    await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height * 0.75);
    await page.getByLabel('Найти элемент').fill('');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const xml = readFileSync((await (await pending).path())!, 'utf8');
    const tasks = Array.from(requireBpmn(xml).getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'serviceTask')).filter(element => element.getAttributeNS(scenario.uri, scenario.attribute) === scenario.value);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.getAttribute('id')).not.toBe(tasks[1]!.getAttribute('id'));
    expect(tasks[1]!.getElementsByTagNameNS(scenario.uri, 'failedJobRetryTimeCycle')).toHaveLength(1);
    const originalError = tasks[0]!.getElementsByTagNameNS(scenario.uri, 'errorEventDefinition')[0];
    const copiedError = tasks[1]!.getElementsByTagNameNS(scenario.uri, 'errorEventDefinition')[0];
    if (copiedError) {
      expect(copiedError.getAttribute('id')).not.toBe(originalError!.getAttribute('id'));
      // Меняем только копию DOM для сравнения остальных атрибутов и детей.
      copiedError.setAttribute('id', originalError!.getAttribute('id')!);
    }
    expect(canonicalElement(tasks[1]!.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'extensionElements')[0]!)).toEqual(canonicalElement(tasks[0]!.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'extensionElements')[0]!));
    if (scenario.sample === 'camunda7-showcase') await (await pending).saveAs('.cache/camunda-edits/copied.bpmn20.xml');
    await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
    const undone = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const restored = readFileSync((await (await undone).path())!, 'utf8');
    expect(preservationIssues(readFileSync(`examples/${scenario.sample}.bpmn20.xml`, 'utf8'), restored)).toEqual([]);
  });

}
