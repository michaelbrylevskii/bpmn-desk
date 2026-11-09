import type { Page } from '@playwright/test';
export async function openMonitor(page: Page, connection?: string) {
  await page.getByRole('button', { name: 'Open monitor', exact: true }).click();
  if (connection) await page.getByRole('menuitem', { name: connection, exact: true }).click();
  else await page.getByRole('menuitem').first().click();
}
export async function newConnection(page: Page) {
  await page.getByRole('button', { name: 'Open monitor', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New connection', exact: true }).click();
}
