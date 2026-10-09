import { errorMessage } from '../../shared/errors';
import type { FailureContext, Notice } from './types';

/** Вид уведомления определяется результатом операции, а не словами в сообщении. */
export function errorNotice(error: unknown, context?: FailureContext): Notice {
  return {
    severity: 'error', title: context?.title ?? 'Не удалось выполнить действие.',
    message: context?.message ?? errorMessage(error),
    details: context?.message ? errorMessage(error) : undefined,
  };
}
