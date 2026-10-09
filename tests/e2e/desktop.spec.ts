import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, rm, copyFile, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';

async function russianProfile(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'language.json'), '"ru"');
  return directory;
}

test('Electron запускает packaged renderer, preload и встроенные примеры', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-e2e-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(directory), ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => !!window.desktop)).toBe(true);
    expect(await page.evaluate(() => 'require' in window)).toBe(false);
    await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
    await expect(page.locator('.outline-item').first()).toBeVisible();
    await expect(page.locator('.import-error')).toHaveCount(0);
    await page.screenshot({ path: 'test-results/desktop-editor.png' });
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('CLI открывает файл и передаёт второй файл в существующее окно', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-cli-'));
  const first = resolve(directory, 'first.bpmn');
  const second = resolve(directory, 'second.bpmn');
  await copyFile('examples/flowable-showcase.bpmn20.xml', first);
  await copyFile('examples/vacation-request.bpmn20.xml', second);
  const env = { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(resolve(directory, 'profile')), ELECTRON_RENDERER_URL: '' };
  const app = await electron.launch({ args: ['.', first], chromiumSandbox: true, env });
  try {
    const page = await app.firstWindow();
    await expect(page.locator('.document-tab')).toContainText('first.bpmn');
    const child = spawn(app.process().spawnfile, ['.', second], { cwd: process.cwd(), env, stdio: 'ignore' });
    await expect(page.locator('.document-tab')).toHaveCount(2);
    await expect(page.locator('.document-tab').last()).toContainText('second.bpmn');
    const exit = await new Promise<number | null>(resolveExit => {
      if (child.exitCode !== null) resolveExit(child.exitCode);
      else child.once('exit', resolveExit);
    });
    expect(exit).toBe(0);
    expect(await app.windows()).toHaveLength(1);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Electron сохраняет копию и отклоняет внешнее изменение файла', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-save-'));
  const path = resolve(directory, 'document.bpmn20.xml');
  await copyFile('examples/flowable-showcase.bpmn20.xml', path);
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(resolve(directory, 'profile')), ELECTRON_RENDERER_URL: '' } });
  try {
    await app.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, path);
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Открыть', exact: true }).first().click();
    await page.getByRole('textbox', { name: 'Найти элемент' }).fill('prepareDocument');
    await page.locator('.outline-item').first().click();
    const field = page.getByLabel('Выражение делегата', { exact: true });
    await field.fill('${nativeEdited}'); await field.blur();
    await expect(page.getByLabel('Несохранённые изменения')).toBeVisible();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Сохранено');
    expect(await readFile(path, 'utf8')).toContain('${nativeEdited}');
    await writeFile(path, '<external-edit/>');
    await field.fill('${secondEdit}'); await field.blur();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('изменён другим приложением');
    expect(await readFile(path, 'utf8')).toBe('<external-edit/>');
    // Отключаем диалог закрытия только в тестовом main process.
    await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('закрытие окна завершает редактирование сфокусированного поля и сохраняет recovery', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-close-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(directory), ELECTRON_RENDERER_URL: '' } });
  try {
    const counter = await app.evaluateHandle(({ dialog }) => {
      const state = { count: 0 };
      dialog.showMessageBoxSync = () => { state.count++; return 0; };
      return state;
    });
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'flowable-showcase', exact: true }).click();
    await page.getByRole('textbox', { name: 'Найти элемент' }).fill('prepareDocument');
    await page.locator('.outline-item').first().click();
    await page.getByLabel('Выражение делегата', { exact: true }).fill('${focusedEdit}');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
    await expect(page.getByLabel('Несохранённые изменения')).toBeVisible();
    await expect.poll(() => counter.evaluate(state => state.count)).toBe(1);
    expect(await page.evaluate(() => localStorage.getItem('bpmn-desk:recovery:v1'))).toContain('${focusedEdit}');
    await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('масштаб интерфейса меняется клавиатурой, меню и восстанавливается', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-zoom-'));
  const env = { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(directory), ELECTRON_RENDERER_URL: '' };
  let app = await electron.launch({ args: ['.'], chromiumSandbox: true, env });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.sendInputEvent({ type: 'keyDown', keyCode: '=', modifiers: ['control'] }));
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor())).toBeCloseTo(1.1);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.sendInputEvent({ type: 'keyDown', keyCode: '0', modifiers: ['control'] }));
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor())).toBe(1);
    await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()!.getMenuItemById('interface-zoom-out')!;
      item.click();
    });
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor())).toBeCloseTo(0.9);
    await expect.poll(async () => JSON.parse(await readFile(resolve(directory, 'interface-zoom.json'), 'utf8')) as number).toBe(0.9);
    await app.close();
    app = await electron.launch({ args: ['.'], chromiumSandbox: true, env });
    await expect((await app.firstWindow()).getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor())).toBeCloseTo(0.9);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('native меню языка меняет интерфейс, сохраняется и не дублирует zoom shortcuts', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-language-'));
  const env = { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' };
  let app = await electron.launch({ args: ['.'], chromiumSandbox: true, env });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: 'New diagram', exact: true })).toBeVisible();
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-menu')!.label)).toBe('Language');
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-ru')!.click());
    await expect(page.getByRole('button', { name: 'Новая схема', exact: true })).toBeVisible();
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-menu')!.label)).toBe('Язык');
    await page.getByRole('combobox', { name: 'Язык', exact: true }).selectOption('en');
    await expect(page.getByRole('button', { name: 'New diagram', exact: true })).toBeVisible();
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-ru')!.click());
    await expect(page.getByRole('button', { name: 'Новая схема', exact: true })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.sendInputEvent({ type: 'keyDown', keyCode: '=', modifiers: ['control'] }));
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor())).toBeCloseTo(1.1);
    expect(JSON.parse(await readFile(resolve(directory, 'language.json'), 'utf8'))).toBe('ru');
    await app.close();
    app = await electron.launch({ args: ['.'], chromiumSandbox: true, env });
    await expect((await app.firstWindow()).getByRole('button', { name: 'Новая схема', exact: true })).toBeVisible();
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-ru')!.checked)).toBe(true);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
