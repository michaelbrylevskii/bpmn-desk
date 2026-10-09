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

test('Electron открывает Camunda 7 через CLI и сохраняет вложенный target в локальный файл', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-camunda-'));
  const path = resolve(directory, 'integration.bpmn20.xml');
  await copyFile('examples/camunda7-integration.bpmn20.xml', path);
  const app = await electron.launch({ args: ['.', path], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(resolve(directory, 'profile')), ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow();
    await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
    await page.getByLabel('Найти элемент').fill('BatchTask');
    await page.locator('.outline-item').first().click();
    const loop = page.locator('.engine-properties').filter({ hasText: 'MultiInstanceLoopCharacteristics' });
    await loop.getByLabel('Коллекция', { exact: true }).fill('nativeItems');
    await loop.getByLabel('Коллекция', { exact: true }).blur();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Сохранено');
    const xml = await readFile(path, 'utf8');
    expect(xml).toContain('c7:collection="nativeItems"');
    expect(xml).toContain('c7:delegateExpression="${notificationWorker}"');
    expect(xml).toContain('demo:version="1"');
    await expect(page.getByLabel('Несохранённые изменения')).toHaveCount(0);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('native создание выбирает профиль, PNG проходит через IPC и не меняет BPMN или recent files', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-export-'));
  const png = resolve(directory, 'diagram.png');
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(resolve(directory, 'profile')), ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('new-diagram')!.click());
    await page.getByRole('dialog').getByRole('button', { name: 'Camunda 7', exact: true }).click();
    await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, png);
    await expect(page.evaluate(() => window.desktop!.saveFile({ format: 'png', name: 'bad.png', content: new Uint8Array([1, 2, 3]) }))).rejects.toThrow('Недопустимый запрос');
    await page.getByTitle('Формат экспорта', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'PNG · белый фон', exact: true }).click();
    await expect(async () => { expect(Array.from((await readFile(png)).subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); }).toPass({ timeout: 5000 });
    expect(await page.evaluate(() => window.desktop!.recentFiles())).toEqual([]);
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
    // Отмена native диалога не создаёт файл и не изменяет документ.
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' }); });
    await page.getByTitle('PNG · белый фон', { exact: true }).click();
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('CLI открывает файл и передаёт второй файл в существующее окно', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-cli-'));
  const first = resolve(directory, 'first.bpmn');
  const second = resolve(directory, 'second.bpmn');
  await copyFile('examples/flowable-showcase.bpmn20.xml', first);
  await copyFile('examples/flowable-vacation-request.bpmn20.xml', second);
  const env = { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(resolve(directory, 'profile')), ELECTRON_RENDERER_URL: '' };
  const app = await electron.launch({ args: ['.', first], chromiumSandbox: true, env });
  try {
    const page = await app.firstWindow();
    await expect(page.locator('.document-tab')).toContainText('first.bpmn');
    // На Windows Playwright запускает Electron через cmd.exe; нужен executable самого приложения.
    const executable = await app.evaluate(() => process.execPath);
    const child = spawn(executable, ['.', second], { cwd: process.cwd(), env, stdio: 'ignore' });
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
    await expect(async () => {
      expect(JSON.parse(await readFile(resolve(directory, 'interface-zoom.json'), 'utf8')) as number).toBe(0.9);
    }).toPass({ timeout: 5000 });
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
