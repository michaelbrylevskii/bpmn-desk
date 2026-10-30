import { expect, test } from '@playwright/test';
import { close, launch, openInstance } from './runtime-fixture';
import { historyServer } from './history-server';

test('язычки сворачивают обе панели, выбор подсвечивает скрытые подробности без раскрытия и потери масштаба', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.finished = false; api.state.unfinishedActivities = true;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openInstance(page, 'p1');
    await expect(page.locator('.runtime-badge[data-activity-id="HistoryReview"]')).toHaveText('✓ 1 · ● 1');
    await expect(page.locator('.runtime-context-bar')).toHaveCount(0);
    const canvas = page.locator('.runtime-canvas'); const node = await canvas.locator('.djs-container').elementHandle();
    const scale = () => canvas.locator('.viewport').evaluate(element => (element as SVGGElement).getCTM()!.a);
    const initialScale = await scale(); const initialWidth = (await canvas.boundingBox())!.width;
    await page.getByTitle('Hide catalog', { exact: true }).click(); await expect(page.locator('.runtime-catalog')).toBeHidden();
    await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(initialWidth + 200);
    await page.getByTitle('Hide details', { exact: true }).click(); await expect(page.locator('.runtime-instance-panel')).toBeHidden();
    const toggle = page.getByTitle('Show details', { exact: true });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const review = canvas.locator('.djs-element[data-element-id="HistoryReview"]'); await review.locator('.djs-hit').click();
    await expect(toggle).toHaveAttribute('data-updated', 'true'); await expect(toggle).toHaveClass(/updated/);
    await expect(page.locator('.runtime-instance-panel')).toBeHidden(); await expect(review).toHaveClass(/selected/);
    await expect.poll(scale).toBeCloseTo(initialScale, 5);
    const time = (await page.locator('.runtime-freshness time').first().boundingBox())!;
    const leftToggle = (await page.getByTitle('Show catalog', { exact: true }).boundingBox())!;
    const rightToggle = (await toggle.boundingBox())!;
    expect(time.x).toBeGreaterThan(leftToggle.x + leftToggle.width); expect(time.x + time.width).toBeLessThan(rightToggle.x);
    await page.screenshot({ path: 'test-results/runtime-panels-collapsed.png' });
    await expect(toggle).not.toHaveClass(/updated/); // Однократная мягкая вспышка, без бесконечного мигания.
    await canvas.locator('.djs-element[data-element-id="HistoryStart"] .djs-hit').click();
    await expect(toggle).toHaveClass(/updated/); await expect(page.locator('.runtime-instance-panel')).toBeHidden();
    const monitor = page.locator('.document-tab[data-kind=monitor]').getByRole('tab');
    await page.locator('.new-tab').click(); await monitor.click();
    await expect(page.locator('.runtime-instance-panel')).toBeHidden(); await expect(page.locator('.runtime-catalog')).toBeHidden();
    await toggle.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.runtime-instance-panel')).toBeVisible(); await expect(page.locator('.runtime-selection')).toContainText('HistoryStart');
    await page.keyboard.press('Tab'); await expect(page.locator('.instance-mode-tabs').getByRole('button', { name: 'Current state', exact: true })).toBeFocused();
    await expect(page.getByTitle('Hide details', { exact: true })).not.toHaveAttribute('data-updated');
    await page.getByTitle('Show catalog', { exact: true }).click(); await expect(page.locator('.runtime-catalog')).toBeVisible();
    await expect.poll(async () => (await canvas.boundingBox())!.width).toBe(initialWidth);
    await expect.poll(scale).toBeCloseTo(initialScale, 5); expect(await node?.evaluate(element => element.isConnected)).toBe(true);
    await page.screenshot({ path: 'test-results/runtime-panels-expanded.png' });
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.getByTitle('Hide details', { exact: true }).click(); await review.locator('.djs-hit').click();
    await expect(page.getByTitle('Show details', { exact: true })).toHaveAttribute('data-updated', 'true');
    await expect(page.getByTitle('Show details', { exact: true })).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.runtime-instance-panel')).toBeHidden();
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
