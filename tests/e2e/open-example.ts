import type { Page } from '@playwright/test';
export async function openExample(page: Page, name: string) {
  await page.getByRole('button', { name: /^(Create diagram|Создать схему)$/ }).click();
  await page.getByRole('menuitem', { name: /^(Sample diagrams|Примеры схем)$/ }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}
