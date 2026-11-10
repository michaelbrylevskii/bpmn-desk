import { test, expect } from '@playwright/test';
import packageInfo from '../../package.json' with { type: 'json' };
import { selectOption } from './select';
import type { UpdateStatus } from '../../src/shared/updates';
const { version } = packageInfo;

test('update badge keeps the installed version, opens the release and silently returns to gray on failure', async ({ page }) => {
  await page.addInitScript(() => {
    let listener: ((status: UpdateStatus) => void) | undefined;
    window.updates = {
      check: async () => undefined,
      status: async () => ({ availableVersion: '99.0.0', checking: false, lastCheck: null }),
      onChanged: callback => { listener = callback; return () => { listener = undefined; }; },
      openRelease: async () => { document.documentElement.dataset.releaseOpened = 'true'; },
    };
    window.addEventListener('test-update-failed', () => listener?.({ availableVersion: null, checking: false, lastCheck: null }));
    window.addEventListener('test-update-ready', () => listener?.({ availableVersion: '99.0.0', checking: false, lastCheck: null }));
  });
  await page.goto('/');
  const badge = page.locator('.version'); const button = page.getByRole('button', { name: 'Version 99.0.0 is available. Open the release on GitHub.', exact: true });
  await expect(button).toHaveText(version);
  for (const theme of ['Light theme', 'Dark theme']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    await expect(button).toHaveClass(/update-available/);
    await button.focus(); await expect(page.getByRole('tooltip').locator('strong')).toHaveText('Version 99.0.0 is available.');
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
  await badge.hover(); await expect(page.getByRole('tooltip').locator('strong')).toHaveText('Доступна версия 99.0.0.');
  await page.evaluate(() => window.dispatchEvent(new Event('test-update-failed')));
  await expect(badge).toHaveText(version); await expect(badge).not.toHaveClass(/update-available/);
  await expect(badge).toBeEnabled(); await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('tooltip').locator('strong')).toHaveText('Обновления приложения');
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
    let resolve: ((status: UpdateStatus) => void) | undefined;
    window.updates = {
      check: async () => undefined,
      status: () => new Promise(done => { resolve = done; }),
      onChanged: callback => {
        const listener = () => { callback({ availableVersion: '99.1.0', checking: false, lastCheck: null }); resolve?.({ availableVersion: null, checking: false, lastCheck: null }); };
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
    let listener: ((status: UpdateStatus) => void) | undefined;
    window.updates = {
      status: async () => ({ availableVersion: null, checking: false, lastCheck: null }),
      onChanged: callback => { listener = callback; return () => { listener = undefined; }; },
      openRelease: async () => undefined,
      check: async () => {
        document.documentElement.dataset.checks = String(Number(document.documentElement.dataset.checks ?? 0) + 1);
        listener?.({ availableVersion: null, checking: true, lastCheck: null });
        await new Promise<void>(resolve => window.addEventListener('test-check-finished', () => {
          listener?.({ availableVersion: null, checking: false, lastCheck: null }); resolve();
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

test('check results, timestamps and actions share one tooltip layout in both themes and locales', async ({ page }) => {
  await page.addInitScript(() => {
    window.updates = {
      status: async () => ({ availableVersion: null, checking: false, lastCheck: null }),
      check: async () => undefined, openRelease: async () => undefined,
      onChanged: callback => {
        const listener = (event: Event) => { if (event instanceof CustomEvent) callback(event.detail as UpdateStatus); };
        window.addEventListener('test-check-result', listener); return () => window.removeEventListener('test-check-result', listener);
      },
    };
  });
  await page.goto('/');
  const completedAt = '2026-11-10T13:39:54.000Z';
  const cases: { result: 'success' | 'error' | 'timeout'; checking?: boolean; availableVersion?: string; en: string; ru: string }[] = [
    { result: 'success', en: 'No new versions found.', ru: 'Новых версий не обнаружено.' },
    { result: 'success', availableVersion: '99.0.0', en: 'Version 99.0.0 is available.', ru: 'Доступна версия 99.0.0.' },
    { result: 'error', en: 'Could not check for updates.', ru: 'Не удалось проверить обновления.' },
    { result: 'timeout', en: 'The update check timed out.', ru: 'Время ожидания проверки истекло.' },
    { result: 'success', checking: true, en: 'Checking for updates…', ru: 'Проверка обновлений…' },
  ];
  for (const locale of ['en', 'ru'] as const) {
    await page.getByRole('button', { name: locale === 'en' ? 'Light theme' : 'Dark theme', exact: true }).click();
    await selectOption(page.locator('.language-picker'), locale);
    for (const item of cases) {
      await page.evaluate(status => window.dispatchEvent(new CustomEvent('test-check-result', { detail: status })), {
        availableVersion: item.availableVersion ?? null, checking: item.checking ?? false, lastCheck: { completedAt, result: item.result },
      });
      await page.locator('.version').hover(); const tooltip = page.getByRole('tooltip');
      await expect(tooltip.locator('strong')).toHaveText(item[locale]);
      await expect(tooltip.locator('time')).toHaveAttribute('datetime', completedAt);
      await expect(tooltip.locator('time')).not.toHaveText('');
      await expect(tooltip.locator('.version-check-time > span')).toHaveText(locale === 'en' ? 'Last checked' : 'Последняя проверка');
      await expect(tooltip.locator('.version-check-action')).toHaveCount(item.checking ? 0 : 1);
      await expect(page.getByRole('alert')).toHaveCount(0);
      if (item.result === 'error') await tooltip.screenshot({ path: `test-results/update-tooltip-${locale}.png` });
    }
  }
});
