import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { requireBpmn, canonicalElement } from '../../src/renderer/bpmn/xml';
import { checkImport } from '../../src/renderer/bpmn/codec';
import { test, expect } from './russian-fixture';
import { createDiagram } from './create-diagram';

async function saveXml(page: Page): Promise<string> {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  return readFileSync((await (await pending).path())!, 'utf8');
}

for (const scenario of [
  { sample: 'flowable-showcase', id: 'prepareDocument', uri: 'http://flowable.org/bpmn', attribute: 'delegateExpression', value: '${prepareDocumentDelegate}' },
  { sample: 'camunda7-showcase', id: 'ArchiveOrder', uri: 'http://camunda.org/schema/1.0/bpmn', attribute: 'topic', value: 'archive-order' },
]) test(`${scenario.sample}: общий буфер переживает закрытие источника, повторные вставки независимы и отменяются`, async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: scenario.sample, exact: true }).click();
  await page.getByLabel('Найти элемент').fill(scenario.id);
  await page.locator('.outline-item').first().click();
  await page.locator('.bpmn-container .djs-container > svg').focus();
  await page.keyboard.press('Control+c');
  await page.locator('.new-tab').click(); await createDiagram(page, 'BPMN 2.0');
  await expect(page.locator('.document-workspace:visible .djs-container')).toBeVisible();
  await page.getByTitle(`Закрыть ${scenario.sample}.bpmn20.xml`, { exact: true }).click();
  for (let count = 1; count <= 2; count++) {
    const canvas = page.locator('.document-workspace:visible .bpmn-container .djs-container > svg');
    await canvas.focus();
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * (0.3 + count * 0.2));
    await page.keyboard.press('Control+v');
    await page.mouse.click(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * (0.3 + count * 0.2));
    await expect(page.locator('.document-workspace:visible .outline-item[title^="bpmn:ServiceTask"]')).toHaveCount(count);
  }
  const xml = await saveXml(page);
  const tasks = Array.from(requireBpmn(xml).getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'serviceTask'));
  expect(tasks).toHaveLength(2);
  expect(tasks[0]!.getAttribute('id')).not.toBe(tasks[1]!.getAttribute('id'));
  const source = Array.from(requireBpmn(readFileSync(`examples/${scenario.sample}.bpmn20.xml`, 'utf8')).getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'serviceTask')).find(item => item.getAttribute('id') === scenario.id)!;
  for (const task of tasks) {
    expect(task.getAttributeNS(scenario.uri, scenario.attribute)).toBe(scenario.value);
    const extension = task.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'extensionElements')[0]!;
    const original = source.getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'extensionElements')[0]!;
    const error = extension.getElementsByTagNameNS(scenario.uri, 'errorEventDefinition')[0];
    if (error) error.setAttribute('id', original.getElementsByTagNameNS(scenario.uri, 'errorEventDefinition')[0]!.getAttribute('id')!);
    expect(canonicalElement(extension)).toEqual(canonicalElement(original));
  }
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  expect(requireBpmn(await saveXml(page)).getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'serviceTask')).toHaveLength(1);
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
  expect(requireBpmn(await saveXml(page)).getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/MODEL', 'serviceTask')).toHaveLength(2);
});

test('копирование группы между схемами сохраняет связи, подпроцессы и граничные события', async ({ page }) => {
  const uri = 'http://www.omg.org/spec/BPMN/20100524/MODEL';
  const source = requireBpmn(readFileSync('examples/flowable-boundary-events.bpmn20.xml', 'utf8'));
  await page.goto('/'); await page.getByRole('button', { name: 'flowable-boundary-events', exact: true }).click();
  await page.locator('.bpmn-container .djs-container > svg').focus();
  await page.keyboard.press('Control+a'); await page.keyboard.press('Control+c');
  await page.locator('.new-tab').click(); await createDiagram(page, 'BPMN 2.0');
  const canvas = page.locator('.document-workspace:visible .bpmn-container .djs-container > svg');
  await canvas.focus(); const bounds = (await canvas.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.7);
  await page.keyboard.press('Control+v'); await page.mouse.click(bounds.x + bounds.width * 0.6, bounds.y + bounds.height * 0.7);
  await expect(page.locator('.document-workspace:visible .outline-item[title^="bpmn:BoundaryEvent"]')).toHaveCount(source.getElementsByTagNameNS(uri, 'boundaryEvent').length);
  const xml = await saveXml(page); const target = requireBpmn(xml);
  for (const name of ['sequenceFlow', 'boundaryEvent', 'subProcess', 'callActivity']) expect(target.getElementsByTagNameNS(uri, name).length).toBe(source.getElementsByTagNameNS(uri, name).length);
  const ids = Array.from(target.getElementsByTagName('*')).map(item => item.getAttribute('id')).filter(Boolean);
  expect(new Set(ids).size).toBe(ids.length);
  for (const element of Array.from(target.getElementsByTagName('*'))) for (const attribute of ['sourceRef', 'targetRef', 'attachedToRef', 'default', 'errorRef', 'messageRef', 'signalRef']) {
    const value = element.getAttribute(attribute); if (value) expect(ids).toContain(value);
  }
  expect((await checkImport(xml)).warnings).toEqual([]);
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  expect(requireBpmn(await saveXml(page)).getElementsByTagNameNS(uri, 'boundaryEvent')).toHaveLength(0);
  await page.locator('.document-tab').first().getByRole('tab').click();
  await expect(page.locator('.document-workspace:visible .outline-item[title^="bpmn:BoundaryEvent"]')).toHaveCount(source.getElementsByTagNameNS(uri, 'boundaryEvent').length);
});
