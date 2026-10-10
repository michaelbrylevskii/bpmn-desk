import type { Locator } from '@playwright/test';

/** Проверяем настоящий popup и выбор мышью, не меняем состояние через DOM. */
export async function selectOption(trigger: Locator, option: string | { label: string }) {
  await trigger.click();
  const choices = trigger.page().getByRole('listbox').getByRole('option');
  await (typeof option === 'string' ? choices.locator(`:scope[data-value="${option}"]`) : trigger.page().getByRole('option', { name: option.label, exact: true })).click();
}
