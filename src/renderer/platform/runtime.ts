import type { RuntimeBridge } from '../../shared/runtime';
declare global { interface Window { runtime?: RuntimeBridge } }
/** Runtime доступен только через main. Web preview остаётся локальным. */
export function runtimeBridge(): RuntimeBridge {
  if (!window.runtime) throw new Error('Подключения к движкам доступны в desktop-приложении.');
  return window.runtime;
}
