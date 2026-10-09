import { test, expect } from './russian-fixture';

test('XML расширений имеет собственные отступы и применяется через undo без изменения соседних данных', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await page.getByRole('textbox', { name: 'Найти элемент' }).fill('prepareDocument');
  await page.locator('.outline-item').first().click();
  await page.getByText('XML расширений', { exact: true }).click();
  const fragment = page.getByLabel('XML расширений', { exact: true });
  const lines = await fragment.locator('.cm-line').allTextContents();
  expect(lines[0]).toMatch(/^<(?:bpmn:)?extensionElements/);
  expect(lines.find(line => line.includes('<flowable:executionListener'))).toMatch(/^ {2}<flowable:executionListener/);
  expect(lines.find(line => line.includes('<flowable:field'))).toMatch(/^ {2}<flowable:field/);
  expect(lines.find(line => line.includes('<flowable:string'))).toMatch(/^ {4}<flowable:string/);
  expect(lines.at(-1)).toMatch(/^<\/(?:bpmn:)?extensionElements>$/);
  await expect(page.getByLabel('Несохранённые изменения')).toHaveCount(0);
  await fragment.fill(lines.join('\n').replace('>general<', '>formatted-category<'));
  await page.getByRole('button', { name: 'Применить расширения', exact: true }).click();
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  const xml = page.getByLabel('XML схемы', { exact: true });
  await expect(xml).toContainText('formatted-category');
  await expect(xml).toContainText('demo:state="ready"');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(xml).not.toContainText('formatted-category');
  await expect(xml).toContainText('>general<');
  await expect(page.getByLabel('Несохранённые изменения')).toHaveCount(0);
});
