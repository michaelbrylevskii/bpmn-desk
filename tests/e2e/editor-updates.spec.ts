import { test, expect } from '@playwright/test';
import packageInfo from '../../package.json' with { type: 'json' };
import { selectOption } from './select';
const { version } = packageInfo;

test('update badge keeps the installed version, opens the release and silently returns to gray on failure', async ({ page }) => {
  await page.addInitScript(() => {
    let listener: ((status: { availableVersion: string | null }) => void) | undefined;
    window.updates = {
      status: async () => ({ availableVersion: '99.0.0' }),
      onChanged: callback => { listener = callback; return () => { listener = undefined; }; },
      openRelease: async () => { document.documentElement.dataset.releaseOpened = 'true'; },
    };
    window.addEventListener('test-update-failed', () => listener?.({ availableVersion: null }));
  });
  await page.goto('/');
  const badge = page.locator('.version'); const button = page.getByRole('button', { name: 'Version 99.0.0 is available. Open the release on GitHub.', exact: true });
  await expect(button).toHaveText(version);
  for (const theme of ['Light theme', 'Dark theme']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await expect(button).toHaveClass(/update-available/);
    await button.focus(); await expect(page.getByRole('tooltip')).toHaveText('Version 99.0.0 is available. Open the release on GitHub.');
    await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1100, height: 800 }); await expect(button).toBeVisible();
  await page.setViewportSize({ width: 1500, height: 960 });
  await button.press('Enter'); await expect(page.locator('html')).toHaveAttribute('data-release-opened', 'true');
  await selectOption(page.getByRole('combobox', { name: 'Language', exact: true }), 'ru');
  await badge.hover(); await expect(page.getByRole('tooltip')).toHaveText('Доступна версия 99.0.0. Открыть релиз на GitHub.');
  await page.evaluate(() => window.dispatchEvent(new Event('test-update-failed')));
  await expect(badge).toHaveText(version); await expect(badge).not.toHaveClass(/update-available/);
  await expect(page.locator('.version-link')).toHaveCount(0); await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('initial status failure leaves the normal badge and the editor available', async ({ page }) => {
  await page.addInitScript(() => {
    window.updates = { status: async () => { throw new Error('unavailable'); }, onChanged: () => () => undefined, openRelease: async () => undefined };
  });
  await page.goto('/'); await expect(page.locator('.version')).toHaveText(version);
  await expect(page.locator('.update-available')).toHaveCount(0); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click(); await expect(page.getByRole('button', { name: 'Create diagram', exact: true })).toBeVisible();
});

test('a new status event wins over a delayed initial snapshot', async ({ page }) => {
  await page.addInitScript(() => {
    let resolve: ((status: { availableVersion: string | null }) => void) | undefined;
    window.updates = {
      status: () => new Promise(done => { resolve = done; }),
      onChanged: callback => {
        const listener = () => { callback({ availableVersion: '99.1.0' }); resolve?.({ availableVersion: null }); };
        window.addEventListener('test-update-ready', listener); return () => window.removeEventListener('test-update-ready', listener);
      },
      openRelease: async () => undefined,
    };
  });
  await page.goto('/'); await expect(page.locator('.version')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('test-update-ready')));
  await expect(page.locator('.update-available')).toHaveAccessibleName('Version 99.1.0 is available. Open the release on GitHub.');
});
