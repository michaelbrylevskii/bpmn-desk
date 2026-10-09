import { chromium, test, type Browser, type ElectronApplication, type Page } from '@playwright/test';
import type { BrowserWindow as NativeWindow } from 'electron';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { errorMessage } from '../../src/shared/errors';

export interface PackagedView { page: Page; browser: Browser }

/** Main остаётся под Electron API. UI подключается по публичному CDP после загрузки
 * реального окна: firstWindow может пропустить уже созданный target executablePath. */
export async function packagedWindow(app: ElectronApplication): Promise<PackagedView> {
  const output: string[] = [];
  const stderr = (chunk: Buffer) => output.push(chunk.toString());
  app.process().stderr?.on('data', stderr);
  let browser: Browser | undefined;
  try {
    const profile = await app.evaluate(async ({ app, BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0] ?? await new Promise<NativeWindow>(resolve => app.once('browser-window-created', (_event, window) => resolve(window)));
      const contents = window.webContents;
      if (!contents.getURL().startsWith('bpmn-desk://app/') || contents.isLoading()) {
        await new Promise<void>((resolve, reject) => {
          const loaded = () => {
            if (!contents.getURL().startsWith('bpmn-desk://app/')) return;
            contents.off('did-finish-load', loaded); contents.off('did-fail-load', failed); resolve();
          };
          const failed = (_event: Electron.Event, code: number, description: string) => {
            contents.off('did-finish-load', loaded); contents.off('did-fail-load', failed);
            reject(new Error(`Главное окно не загрузилось: ${code} ${description}`));
          };
          contents.on('did-finish-load', loaded); contents.on('did-fail-load', failed);
        });
      }
      return app.getPath('userData');
    });
    const [port, endpoint] = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).trim().split(/\r?\n/);
    if (!port || !/^\d+$/.test(port) || !endpoint?.startsWith('/devtools/browser/')) throw new Error('Некорректный CDP endpoint готового приложения.');
    browser = await chromium.connectOverCDP(`ws://127.0.0.1:${port}${endpoint}`, { timeout: 10000 });
    const page = browser.contexts().flatMap(context => context.pages()).find(page => page.url().startsWith('bpmn-desk://app/'));
    if (!page) throw new Error('В CDP не найдено главное окно BPMN Desk.');
    return { page, browser };
  } catch (error) {
    const state = await app.evaluate(({ app, BrowserWindow }) => ({
      ready: app.isReady(), packaged: app.isPackaged,
      windows: BrowserWindow.getAllWindows().map(window => ({ id: window.id, url: window.webContents.getURL(), visible: window.isVisible(), loading: window.webContents.isLoading() })),
    })).catch(problem => ({ inspectionError: errorMessage(problem) }));
    const details = JSON.stringify({ state, stderr: output.join('') }, null, 2);
    await test.info().attach('packaged-startup', { body: details, contentType: 'application/json' });
    await browser?.close();
    throw new Error(`${errorMessage(error)}\n${details}`, { cause: error });
  } finally { app.process().stderr?.off('data', stderr); }
}
