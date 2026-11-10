import { test, expect } from '@playwright/test';
import packageInfo from '../../package.json' with { type: 'json' };
import { selectOption } from './select';
const { version } = packageInfo;

test('update badge keeps the installed version, opens the release and silently returns to gray on failure', async ({ page }) => {
  await page.addInitScript(() => {
    let listener: ((status: { availableVersion: string | null; checking: boolean }) => void) | undefined;
    window.updates = {
      check: async () => undefined,
      status: async () => ({ availableVersion: '99.0.0', checking: false }),
      onChanged: callback => { listener = callback; return () => { listener = undefined; }; },
      openRelease: async () => { document.documentElement.dataset.releaseOpened = 'true'; },
    };
    window.addEventListener('test-update-failed', () => listener?.({ availableVersion: null, checking: false }));
    window.addEventListener('test-update-ready', () => listener?.({ availableVersion: '99.0.0', checking: false }));
  });
  await page.goto('/');
  const badge = page.locator('.version'); const button = page.getByRole('button', { name: 'Version 99.0.0 is available. Open the release on GitHub.', exact: true });
  await expect(button).toHaveText(version);
  for (const theme of ['Light theme', 'Dark theme']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await expect(button).toHaveClass(/update-available/);
    await button.focus(); await expect(page.getByRole('tooltip')).toHaveText('Version 99.0.0 is available. Open the release on GitHub.');
    await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip')).toHaveCount(0);
    const availableBox = await badge.boundingBox();
    await page.evaluate(() => window.dispatchEvent(new Event('test-update-failed')));
    await expect(badge).toBeEnabled(); expect(await badge.boundingBox()).toEqual(availableBox);
    expect(await badge.evaluate(element => getComputedStyle(element).userSelect)).toBe('none');
    await page.evaluate(() => window.dispatchEvent(new Event('test-update-ready')));
    await expect(button).toBeEnabled(); expect(await badge.boundingBox()).toEqual(availableBox);
  }
  await page.setViewportSize({ width: 1100, height: 800 }); await expect(button).toBeVisible();
  await page.setViewportSize({ width: 1500, height: 960 });
  await button.press('Enter'); await expect(page.locator('html')).toHaveAttribute('data-release-opened', 'true');
  await selectOption(page.getByRole('combobox', { name: 'Language', exact: true }), 'ru');
  await badge.hover(); await expect(page.getByRole('tooltip')).toHaveText('Доступна версия 99.0.0. Открыть релиз на GitHub.');
  await page.evaluate(() => window.dispatchEvent(new Event('test-update-failed')));
  await expect(badge).toHaveText(version); await expect(badge).not.toHaveClass(/update-available/);
  await expect(badge).toBeEnabled(); await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('tooltip')).toHaveText('Проверить обновления');
});

test('initial status failure leaves the normal badge and the editor available', async ({ page }) => {
  await page.addInitScript(() => {
    window.updates = { check: async () => undefined, status: async () => { throw new Error('unavailable'); }, onChanged: () => () => undefined, openRelease: async () => undefined };
  });
  await page.goto('/'); await expect(page.locator('.version')).toHaveText(version);
  await expect(page.locator('.update-available')).toHaveCount(0); await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByTitle('New tab (Ctrl+N)', { exact: true }).click(); await expect(page.getByRole('button', { name: 'Create diagram', exact: true })).toBeVisible();
});

test('a new status event wins over a delayed initial snapshot', async ({ page }) => {
  await page.addInitScript(() => {
    let resolve: ((status: { availableVersion: string | null; checking: boolean }) => void) | undefined;
    window.updates = {
      check: async () => undefined,
      status: () => new Promise(done => { resolve = done; }),
      onChanged: callback => {
        const listener = () => { callback({ availableVersion: '99.1.0', checking: false }); resolve?.({ availableVersion: null, checking: false }); };
        window.addEventListener('test-update-ready', listener); return () => window.removeEventListener('test-update-ready', listener);
      },
      openRelease: async () => undefined,
    };
  });
  await page.goto('/'); await expect(page.locator('.version')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('test-update-ready')));
  await expect(page.locator('.update-available')).toHaveAccessibleName('Version 99.1.0 is available. Open the release on GitHub.');
});

test('manual checks animate the button background without resizing or duplicate clicks', async ({ page }) => {
  await page.addInitScript(() => {
    let listener: ((status: { availableVersion: string | null; checking: boolean }) => void) | undefined;
    window.updates = {
      status: async () => ({ availableVersion: null, checking: false }),
      onChanged: callback => { listener = callback; return () => { listener = undefined; }; },
      openRelease: async () => undefined,
      check: async () => {
        document.documentElement.dataset.checks = String(Number(document.documentElement.dataset.checks ?? 0) + 1);
        listener?.({ availableVersion: null, checking: true });
        await new Promise<void>(resolve => window.addEventListener('test-check-finished', () => {
          listener?.({ availableVersion: null, checking: false }); resolve();
        }, { once: true }));
      },
    };
  });
  await page.goto('/'); const badge = page.locator('.version');
  await expect(badge).toHaveAccessibleName('Check for updates'); const idleBox = await badge.boundingBox();
  await badge.click(); await expect(badge).toBeDisabled(); await expect(badge).toHaveAttribute('aria-busy', 'true');
  expect(await badge.boundingBox()).toEqual(idleBox);
  for (const theme of ['Light theme', 'Dark theme']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    const animation = await badge.evaluate(element => ({ name: getComputedStyle(element).animationName, image: getComputedStyle(element).backgroundImage }));
    expect(animation.name).not.toBe('none'); expect(animation.image).toContain('linear-gradient');
  }
  await badge.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
  await expect(page.locator('html')).toHaveAttribute('data-checks', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await badge.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await page.evaluate(() => window.dispatchEvent(new Event('test-check-finished')));
  await expect(badge).toBeEnabled(); await expect(badge).toHaveAttribute('aria-busy', 'false');
  expect(await badge.boundingBox()).toEqual(idleBox);
  expect(await badge.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
