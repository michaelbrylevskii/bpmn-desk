import type { Page } from '@playwright/test';
/** Реальное меню команд, общий путь создания с главной и новой вкладки. */
export async function createDiagram(page: Page, profile: 'BPMN 2.0' | 'Flowable' | 'Camunda 7') {
  await page.getByRole('button', { name: /^(Create diagram|Создать схему)$/ }).click();
  await page.getByRole('menuitem', { name: profile, exact: true }).click();
}
