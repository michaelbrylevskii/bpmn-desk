import { test as base } from '@playwright/test';
export { expect } from '@playwright/test';

/** Исходные сценарии проверяют русскую локаль явно, новый профиль приложения — en. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => { if (!localStorage.getItem('bpmn-desk:language')) localStorage.setItem('bpmn-desk:language', 'ru'); });
    await use(page);
  },
});
