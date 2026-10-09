import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { translate, type Language } from '../shared/i18n';
import { atomicWrite } from './file-store';
/** Масштаб Chromium относится ко всему интерфейсу, независимо от BPMN viewport. */
export async function interfaceZoomMenu(window: BrowserWindow, language: () => Language): Promise<() => MenuItemConstructorOptions[]> {
  const path = join(app.getPath('userData'), 'interface-zoom.json');
  let factor = 1;
  try {
    const saved: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (typeof saved === 'number' && Number.isFinite(saved)) factor = Math.max(0.5, Math.min(1.75, saved));
  } catch { /* Первый запуск или повреждённые настройки: 100%. */ }
  let writes = Promise.resolve();
  const apply = (next: number) => {
    factor = Math.round(Math.max(0.5, Math.min(1.75, next)) * 100) / 100;
    window.webContents.setZoomFactor(factor);
    const item = Menu.getApplicationMenu()?.getMenuItemById('interface-zoom-value');
    if (item) item.label = translate(language(), 'Масштаб интерфейса: {value}%', { value: Math.round(factor * 100) });
    writes = writes.catch(() => undefined).then(() => atomicWrite(path, JSON.stringify(factor)));
    void writes.catch(error => console.error('Не удалось сохранить масштаб интерфейса:', error));
  };
  window.webContents.on('did-finish-load', () => window.webContents.setZoomFactor(factor));
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || input.alt) return;
    if (['+', '=', '-'].includes(input.key) || (input.key === '0' && !input.shift)) {
      event.preventDefault();
      apply(input.key === '0' ? 1 : factor + (input.key === '-' ? -0.1 : 0.1));
    }
  });
  return () => [
    { id: 'interface-zoom-value', label: translate(language(), 'Масштаб интерфейса: {value}%', { value: Math.round(factor * 100) }), enabled: false },
    { id: 'interface-zoom-in', label: translate(language(), 'Увеличить интерфейс'), accelerator: 'CmdOrCtrl+Plus', click: () => apply(factor + 0.1) },
    { id: 'interface-zoom-out', label: translate(language(), 'Уменьшить интерфейс'), accelerator: 'CmdOrCtrl+-', click: () => apply(factor - 0.1) },
    { id: 'interface-zoom-reset', label: translate(language(), 'Масштаб интерфейса 100%'), accelerator: 'CmdOrCtrl+0', click: () => apply(1) },
  ];
}
