import { expect, test } from '@playwright/test';
import { close, launch, openInstance } from './runtime-fixture';
import { historyServer } from './history-server';

test('легенда, время и карточки компактны; пояснения открываются наведением и клавиатурой', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.finished = false; api.state.related = true;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openInstance(page, 'p1');
    const legend = page.locator('.runtime-legend'); await expect(legend.locator('.runtime-legend-item')).toHaveCount(4);
    expect((await legend.boundingBox())!.height).toBeLessThanOrEqual(30);
    const positions = await legend.locator('.runtime-legend-item').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
    expect(new Set(positions).size).toBe(1); await expect(legend).not.toContainText('History marks');
    const ended = legend.getByText('Ended', { exact: true }); await ended.hover();
    await expect(page.getByRole('tooltip')).toContainText('do not confirm success');
    await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toHaveCount(0);
    await ended.focus(); await expect(page.getByRole('tooltip')).toContainText('End recorded');
    await page.keyboard.press('Escape'); await ended.blur();
    const footer = page.locator('.runtime-freshness');
    await expect(footer.locator('time')).toHaveCount(2); expect((await footer.boundingBox())!.height).toBeLessThanOrEqual(32);
    const times = await footer.locator('time').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top)); expect(new Set(times).size).toBe(1);
    await expect(footer).not.toContainText('multiple requests');
    await footer.locator('.runtime-snapshot-times').focus(); await expect(page.getByRole('tooltip')).toContainText('multiple requests'); await page.keyboard.press('Escape');
    const card = page.locator('.instance-relationships .instance-card'); await expect(card.locator('strong')).toHaveText('Child Review decisions');
    await expect(card.locator('small')).toHaveText('Other instance'); await expect(card.locator('code')).toHaveText('p2');
    await expect(card).not.toContainText('Child instance');
    await page.setViewportSize({ width: 1050, height: 720 });
    expect((await legend.boundingBox())!.height).toBeLessThanOrEqual(30); expect((await footer.boundingBox())!.height).toBeLessThanOrEqual(32);
    for (const theme of ['Light theme', 'Dark theme']) { await page.getByTitle(theme, { exact: true }).click(); await page.screenshot({ path: `test-results/runtime-compact-${theme.startsWith('Light') ? 'light' : 'dark'}.png` }); }
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
