import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extraSchemaPack } from '../../scripts/lib/schema-pack.mjs';
import { preservationIssues, requireBpmn } from '../../src/renderer/bpmn/xml';

const pack = extraSchemaPack();
for (const entry of pack.entries) {
  test(`${entry.file}: открыть и сохранить через интерфейс`, async ({ page }) => {
    const source = readFileSync(entry.path, 'utf8');
    const hasDiagram = requireBpmn(source).getElementsByTagNameNS('http://www.omg.org/spec/BPMN/20100524/DI', 'BPMNShape').length > 0;
    test.skip(!hasDiagram, 'Нет BPMN DI: roundtrip проверяется отдельно, визуальная раскладка не создаётся автоматически.');
    await page.goto('/');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Open', exact: true }).first().click();
    await (await chooser).setFiles(entry.path);
    await expect(page.locator('.outline-item').first()).toBeVisible();
    await expect(page.locator('.import-error')).toHaveCount(0);
    await expect(page.locator('.djs-container svg').first()).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const saved = await download;
    const output = resolve('.cache/extra-schema-exports', entry.file);
    await saved.saveAs(output);
    expect(preservationIssues(source, readFileSync(output, 'utf8'))).toEqual([]);
  });
}
