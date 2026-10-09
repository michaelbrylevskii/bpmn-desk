import { test, expect } from './russian-fixture';
import provenance from '../../examples/provenance.json' with { type: 'json' };
import { readFileSync } from 'node:fs';
import { preservationIssues } from '../../src/renderer/bpmn/xml';
import { emptyDiagram } from '../../src/renderer/bpmn/template';

test('редактирование Flowable, undo/redo и сохранение демонстрационной схемы', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await expect(page.locator('.djs-container svg').first()).toBeVisible();
  const search = page.getByRole('textbox', { name: 'Найти элемент' });
  await search.fill('prepareDocument');
  await page.locator('.outline-item').first().click();
  const field = page.getByLabel('Выражение делегата', { exact: true });
  const original = await field.inputValue();
  await field.fill('${editedDelegate}');
  await field.blur();
  await expect(page.getByLabel('Несохранённые изменения')).toBeVisible();
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(field).toHaveValue(original);
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
  await expect(field).toHaveValue('${editedDelegate}');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const saved = readFileSync(path!, 'utf8');
  expect(saved).toContain('${editedDelegate}');
  const before = readFileSync('examples/flowable-showcase.bpmn20.xml', 'utf8');
  const issues = preservationIssues(before, saved);
  expect(issues.every(issue => issue.includes('delegateExpression'))).toBe(true);
  await expect(page.getByLabel('Несохранённые изменения')).toHaveCount(0);
});

test('все встроенные схемы отображаются и сохраняют расширения', async ({ page }) => {
  const names = provenance.filter(record => record.engine === 'flowable').map(record => record.file.replace('.bpmn20.xml', ''));
  for (const name of names) {
    await page.goto('/');
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator('.outline-item').first()).toBeVisible();
    await expect(page.locator('.import-error')).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
    await expect(page.getByLabel('Unsaved changes', { exact: true })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('ru');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    const download = await pending;
    await download.saveAs(`.cache/flowable-exports/${name}.bpmn20.xml`);
    const path = await download.path();
    expect(preservationIssues(readFileSync(`examples/${name}.bpmn20.xml`, 'utf8'), readFileSync(path!, 'utf8'))).toEqual([]);
  }
});

test('кастомные атрибуты и XML расширений редактируются и отменяются', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая схема', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await page.locator('.outline-item').filter({ hasText: 'StartEvent_1' }).click();
  await page.getByText('Дополнительные атрибуты', { exact: true }).click();
  await page.getByLabel('Имя атрибута').fill('custom:mode');
  await page.getByLabel('URI пространства имён').fill('urn:custom');
  await page.getByLabel('Значение атрибута').fill('strict');
  await page.getByRole('button', { name: 'Добавить', exact: true }).click();
  await expect(page.getByLabel('custom:mode', { exact: true })).toHaveValue('strict');
  await page.getByTitle('Отменить (Ctrl+Z)', { exact: true }).click();
  await expect(page.getByLabel('custom:mode', { exact: true })).toHaveCount(0);
  await page.getByTitle('Повторить (Ctrl+Shift+Z)', { exact: true }).click();
  await expect(page.getByLabel('custom:mode', { exact: true })).toHaveValue('strict');
  await page.getByText('XML расширений', { exact: true }).click();
  const content = page.getByLabel('XML расширений', { exact: true });
  await content.fill('<bpmn:extensionElements xmlns:custom="urn:custom"><custom:data custom:flag="yes">value</custom:data></bpmn:extensionElements>');
  await page.getByRole('button', { name: 'Применить расширения' }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const xml = readFileSync((await (await pending).path())!, 'utf8');
  expect(xml).toContain('custom:mode="strict"');
  expect(xml).toContain('custom:flag="yes"');
  expect(xml).toContain('value');
});

test('вкладки независимы, локальное восстановление сохраняет изменения', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая схема', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await page.locator('.outline-item').filter({ hasText: 'StartEvent_1' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Восстановленный старт');
  await page.getByLabel('Название', { exact: true }).blur();
  await expect(page.getByLabel('Несохранённые изменения')).toBeVisible();
  await page.getByTitle('Новая схема (Ctrl+N)').click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await expect(page.locator('.document-tab')).toHaveCount(2);
  await page.reload();
  await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(page.locator('.outline-item').filter({ hasText: 'Восстановленный старт' })).toBeVisible();
  await expect(page.getByLabel('Несохранённые изменения')).toBeVisible();
});

test('ошибочный XML не заменяет диаграмму', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая схема', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await expect(page.locator('.outline-item').first()).toBeVisible();
  await page.getByRole('button', { name: 'XML', exact: true }).click();
  await page.getByLabel('XML схемы').fill('<broken>');
  await page.getByRole('button', { name: 'Применить XML', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Некорректный XML');
  await expect(page.locator('.outline-item').filter({ hasText: 'StartEvent_1' })).toBeVisible();
});

test('listeners, поля и определения редактируются через формы с undo/redo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Новая схема', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Flowable', exact: true }).click();
  await page.locator('.outline-item').filter({ hasText: 'StartEvent_1' }).click();
  await page.getByText('Обработчики процесса · executionListener', { exact: true }).click();
  await page.getByRole('button', { name: 'Добавить executionListener', exact: true }).click();
  await page.getByLabel('executionListener: delegateExpression', { exact: true }).fill('${listenerBean}');
  await page.getByLabel('executionListener: delegateExpression', { exact: true }).blur();
  await page.getByText('Поля · field', { exact: true }).click();
  await page.getByRole('button', { name: 'Добавить field', exact: true }).click();
  await page.getByLabel('Значение поля', { exact: true }).fill('полезное значение');
  await page.getByLabel('Значение поля', { exact: true }).blur();
  await page.getByRole('button', { name: 'Определения', exact: true }).click();
  await page.getByRole('button', { name: 'Error', exact: true }).click();
  await page.getByLabel('errorCode', { exact: true }).fill('CUSTOM_ERROR');
  await page.getByLabel('errorCode', { exact: true }).blur();
  await page.getByTitle('Закрыть определения').click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const xml = readFileSync((await (await pending).path())!, 'utf8');
  expect(xml).toContain('delegateExpression="${listenerBean}"');
  expect(xml).toContain('<flowable:string>полезное значение</flowable:string>');
  expect(xml).toContain('errorCode="CUSTOM_ERROR"');
});

test('развёрнутые подпроцессы отображают дочерние элементы на общей plane', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
  await expect(page.locator('.djs-element[data-element-id="reviewDocument"]')).toBeVisible();
});

test('исправление повреждённого файла через XML считается несохранённым изменением', async ({ page }) => {
  await page.goto('/');
  const pending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Открыть', exact: true }).first().click();
  await (await pending).setFiles({ name: 'broken.bpmn', mimeType: 'application/xml', buffer: Buffer.from('<broken>') });
  await expect(page.locator('.import-error')).toBeVisible();
  await page.getByRole('button', { name: 'Открыть XML', exact: true }).click();
  await page.getByLabel('XML схемы').fill(emptyDiagram);
  await page.getByRole('button', { name: 'Применить XML', exact: true }).click();
  await expect(page.locator('.import-error')).toHaveCount(0);
  await expect(page.getByLabel('Несохранённые изменения')).toBeVisible();
});
