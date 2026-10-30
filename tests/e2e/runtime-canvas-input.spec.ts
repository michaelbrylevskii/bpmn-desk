import { expect, test } from '@playwright/test';
import { close, launch, openInstance } from './runtime-fixture';
import { historyServer } from './history-server';

test('колёсико над бейджем прокручивает холст по обеим осям и масштабирует его', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.finished = false;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openInstance(page, 'p1');
    const badge = page.locator('.runtime-badge[data-activity-id="HistoryReview"]');
    await expect(badge).toHaveText('✓ 2 · ● 1');
    const matrix = () => page.locator('.runtime-canvas .viewport').evaluate(element => {
      const value = (element as SVGGElement).getCTM()!;
      return { scale: value.a, x: value.e, y: value.f };
    });
    for (const gesture of ['vertical', 'horizontal', 'shift', 'zoom'] as const) {
      await page.getByTitle('Fit diagram', { exact: true }).click();
      const before = await matrix(); const box = (await badge.boundingBox())!;
      // Настоящее наведение снаружи SVG и wheel; dispatchEvent не воспроизводит mouseout холста.
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const modifier = gesture === 'shift' ? 'Shift' : gesture === 'zoom' ? 'Control' : undefined;
      if (modifier) await page.keyboard.down(modifier);
      try { await page.mouse.wheel(gesture === 'horizontal' ? 40 : 0, gesture === 'horizontal' ? 0 : gesture === 'zoom' ? -60 : 40); }
      finally { if (modifier) await page.keyboard.up(modifier); }
      if (gesture === 'zoom') await expect.poll(async () => (await matrix()).scale).toBeGreaterThan(before.scale);
      else {
        const axis = gesture === 'vertical' ? 'y' : 'x'; const other = axis === 'y' ? 'x' : 'y';
        await expect.poll(async () => Math.abs((await matrix())[axis] - before[axis])).toBeGreaterThan(10);
        expect((await matrix())[other]).toBeCloseTo(before[other], 3);
        expect((await matrix()).scale).toBeCloseTo(before.scale, 5);
      }
    }
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});

test('логотип не пересекается с язычком, холст не перекрывает кнопки панелей', async () => {
  const api = await historyServer(); api.state.runtimeStatus = 200; api.state.finished = false;
  const { app, page, directory } = await launch(api.baseUrl).catch(async error => { await api.stop(); throw error; });
  try {
    await openInstance(page, 'p1');
    for (const width of [1500, 1050]) {
      await page.setViewportSize({ width, height: 720 });
      for (const hidden of [false, true]) {
        const right = page.getByTitle(hidden ? 'Show details' : 'Hide details', { exact: true });
        const logo = page.locator('.runtime-canvas .bjs-powered-by'); await expect(logo).toBeVisible();
        await expect.poll(async () => {
          const a = (await logo.boundingBox())!; const b = (await right.boundingBox())!;
          return Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        }).toBe(0);
        for (const toggle of await page.locator('.runtime-panel-toggle').all()) {
          expect(await toggle.evaluate(element => {
            const box = element.getBoundingClientRect();
            // Точки у краёв остаются внутри скруглённых углов кнопки.
            return [[3, 8], [box.width / 2, box.height / 2], [box.width - 3, box.height - 8]].map(([x, y]) => element.contains(document.elementFromPoint(box.x + x!, box.y + y!)));
          })).toEqual([true, true, true]);
        }
        await right.click();
      }
    }
    for (const theme of ['Light theme', 'Dark theme']) { await page.getByTitle(theme, { exact: true }).click(); await page.screenshot({ path: `test-results/runtime-canvas-controls-${theme.startsWith('Light') ? 'light' : 'dark'}.png` }); }
  } finally { try { await close(app, directory); } finally { await api.stop(); } }
});
