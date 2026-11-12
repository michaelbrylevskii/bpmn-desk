import { openExample } from './open-example';
import { createDiagram } from './create-diagram';
import { selectOption } from './select';
import { test, expect, _electron as electron } from '@playwright/test';
import { resolve } from 'node:path';
import { mkdir, mkdtemp, rm, copyFile, readFile, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { packagedWindow } from './packaged-window';

async function russianProfile(directory: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'language.json'), '"ru"');
  return directory;
}

test('окно о приложении читает настоящие версии и открывает только разрешённые ссылки', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-about-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow();
    const actual = await app.evaluate(({ app }) => ({ version: app.getVersion(), electron: process.versions.electron, chromium: process.versions.chrome, node: process.versions.node, platform: process.platform, arch: process.arch }));
    expect(await page.evaluate(() => window.application!.info())).toEqual(actual);
    await app.evaluate(({ shell }) => { shell.openExternal = async url => { process.env.BPMN_DESK_ABOUT_LINK_TEST = url; }; });
    await page.getByRole('button', { name: 'About', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'About', exact: true });
    await expect(dialog).toContainText(`Version ${actual.version}`);
    await dialog.getByRole('link', { name: 'Project on GitHub', exact: true }).click();
    expect(await app.evaluate(() => process.env.BPMN_DESK_ABOUT_LINK_TEST)).toBe('https://github.com/michaelbrylevskii/bpmn-desk');
    const rejected = await page.evaluate(async () => {
      try { await Reflect.apply(window.application!.openLink, undefined, ['https://invalid.example/']); return false; } catch { return true; }
    });
    expect(rejected).toBe(true);
    expect(await app.evaluate(() => process.env.BPMN_DESK_ABOUT_LINK_TEST)).toBe('https://github.com/michaelbrylevskii/bpmn-desk');
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('фоновая проверка не блокирует окно, синхронизирует бейджи и открывает только страницу релизов', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-updates-'));
  const app = await electron.launch({ args: ['tests/e2e/update-main.mjs'], chromiumSandbox: true,
    env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
  let browser: import('@playwright/test').Browser | undefined;
  try {
    const view = await packagedWindow(app); const page = view.page; browser = view.browser;
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.version')).not.toHaveClass(/update-available/);
    expect(await page.evaluate(() => !!window.updates)).toBe(true);
    const next = page.context().waitForEvent('page');
    await app.evaluate(({ Menu }) => {
      const file = Menu.getApplicationMenu()?.items[0];
      const action = file?.submenu?.items.find(item => item.id === 'new-window');
      if (!action) throw new Error('New window action missing'); action.click();
    });
    const other = await next; await expect(other.getByRole('heading', { level: 1 })).toBeVisible();
    await expect.poll(() => app.evaluate(() => Reflect.get(Reflect.get(globalThis, 'releaseFixture'), 'requests') as number)).toBe(1);
    await app.evaluate(() => {
      const complete: unknown = Reflect.get(Reflect.get(globalThis, 'releaseFixture'), 'complete');
      if (typeof complete !== 'function') throw new Error('Release request missing'); complete('v0.0.0');
    });
    for (const window of [page, other]) await expect(window.locator('.version')).toBeEnabled();
    await page.locator('.version').click();
    for (const window of [page, other]) await expect(window.locator('.version')).toHaveAttribute('aria-busy', 'true');
    await other.evaluate(() => { void window.updates!.check(); });
    expect(await app.evaluate(() => Reflect.get(Reflect.get(globalThis, 'releaseFixture'), 'requests') as number)).toBe(2);
    await app.evaluate(() => {
      const complete: unknown = Reflect.get(Reflect.get(globalThis, 'releaseFixture'), 'complete');
      if (typeof complete !== 'function') throw new Error('Release request missing'); complete();
    });
    for (const window of [page, other]) await expect(window.locator('.update-available')).toHaveAccessibleName('Version 99.0.0 is available. Open the release on GitHub.');
    await other.locator('.update-available').click();
    await expect.poll(() => app.evaluate(() => Reflect.get(Reflect.get(globalThis, 'releaseFixture'), 'opened') as string[]))
      .toEqual(['https://github.com/michaelbrylevskii/bpmn-desk/releases/latest']);
    await page.screenshot({ path: 'test-results/update-badge.png' });
  } finally { await browser?.close(); await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('Electron запускает packaged renderer, preload и встроенные примеры', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-e2e-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(directory), ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const manage = page.locator('.toolbar').getByTitle('Управление подключениями', { exact: true });
    await expect(manage).toHaveCount(1); await manage.click();
    await expect(page.getByRole('dialog').getByLabel('Название подключения')).toHaveValue('');
    await page.getByRole('dialog').getByTitle('Закрыть', { exact: true }).click();
    expect(await page.evaluate(() => !!window.desktop)).toBe(true);
    expect(await page.evaluate(() => 'require' in window)).toBe(false);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMenuBarVisible())).toBe(false);
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isMenuBarAutoHide())).toBe(true);
    await openExample(page, 'flowable-showcase');
    await expect(page.locator('.outline-item').first()).toBeVisible();
    await expect(page.locator('.import-error')).toHaveCount(0);
    await manage.click(); await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByTitle('Закрыть', { exact: true }).click();
    await page.screenshot({ path: 'test-results/desktop-editor.png' });
  } finally { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('nativeTheme переключает системную палитру; ручной режим переживает перезапуск', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-theme-'));
  const env = { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(directory), ELECTRON_RENDERER_URL: '' };
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env });
  try {
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: 'Системная тема', exact: true })).toHaveAttribute('aria-pressed', 'true');
    // Playwright по умолчанию эмулирует light; здесь проверяется тема самого Electron.
    await page.emulateMedia({ colorScheme: null });
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'dark'; });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await app.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light'; });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Тёмная тема', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('bpmn-desk:theme'))).toBe('dark');
  } finally { await app.close(); }
  try {
    const reopened = await electron.launch({ args: ['.'], chromiumSandbox: true, env });
    try {
      const page = await reopened.firstWindow();
      await expect(page.getByRole('button', { name: 'Тёмная тема', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await page.emulateMedia({ colorScheme: null });
      await reopened.evaluate(({ nativeTheme }) => { nativeTheme.themeSource = 'light'; });
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.getByRole('button', { name: 'Системная тема', exact: true }).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    } finally { await reopened.close(); }
  } finally { await rm(directory, { recursive: true, force: true }); }
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
    await expect(page.getByRole('button', { name: 'Создать схему', exact: true })).toBeVisible();
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('new-diagram')!.click());
    await createDiagram(page, 'Camunda 7');
    await expect(page.locator('.engine-badge')).toHaveText('Camunda 7');
    await expect(page.locator('.unbound-dot')).toBeVisible();
    const closing = await app.evaluateHandle(({ dialog, BrowserWindow }) => {
      const state = { count: 0 }; dialog.showMessageBoxSync = () => { state.count++; return 0; };
      BrowserWindow.getAllWindows()[0]!.close(); return state;
    });
    await expect.poll(async () => (await closing.jsonValue()).count).toBe(1);
    await expect(page.locator('.unbound-dot')).toBeVisible();
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, png);
    await expect(page.evaluate(() => window.desktop!.saveFile({ format: 'png', name: 'bad.png', content: new Uint8Array([1, 2, 3]) }))).rejects.toThrow('Недопустимый запрос');
    await page.getByTitle('Формат экспорта', { exact: true }).click();
    await page.getByRole('menuitem', { name: 'PNG · белый фон', exact: true }).click();
    await expect(async () => { expect(Array.from((await readFile(png)).subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); }).toPass({ timeout: 5000 });
    const revealed = await app.evaluateHandle(({ shell }) => {
      const paths: string[] = []; shell.showItemInFolder = path => { paths.push(path); }; return paths;
    });
    await expect(page.locator('.toast')).toContainText('Экспортировано: diagram.png');
    await page.getByRole('button', { name: 'Показать в папке', exact: true }).click();
    expect(await revealed.jsonValue()).toEqual([png]);
    await page.getByTitle('Закрыть уведомление', { exact: true }).click();
    await expect.poll(() => app.evaluate(({ Menu }) => ['export-png', 'export-png-transparent'].map(id => {
      const item = Menu.getApplicationMenu()!.getMenuItemById(id)!; return { enabled: item.enabled, label: item.label };
    }))).toEqual([{ enabled: true, label: 'Экспорт PNG с белым фоном…' }, { enabled: true, label: 'Экспорт PNG с прозрачным фоном…' }]);
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('export-png-transparent')!.click());
    await expect(page.locator('.toast')).toContainText('Экспортировано: diagram.png');
    const pixels = await page.evaluate(async bytes => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const context = canvas.getContext('2d')!; context.drawImage(bitmap, 0, 0); bitmap.close();
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    }, Array.from(await readFile(png)));
    expect(pixels).toEqual([0, 0, 0, 0]);
    await page.getByTitle('Закрыть уведомление', { exact: true }).click();
    expect(await page.evaluate(() => window.desktop!.recentFiles())).toEqual([]);
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
    // Отмена native диалога не создаёт файл и не изменяет документ.
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true, filePath: '' }); });
    await page.getByTitle('PNG · белый фон', { exact: true }).click();
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
    await expect(page.locator('.toast[data-severity=success]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.locator('.unbound-dot')).toBeVisible();
    const saved = resolve(directory, 'saved.bpmn');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, saved);
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Сохранено: saved.bpmn');
    await expect(page.locator('.unbound-dot')).toHaveCount(0);
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
    expect(await readFile(saved, 'utf8')).toContain('definitions');
  } finally { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('повторный запуск с файлом использует активное окно, без файла открывает новое', async () => {
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
    const opened = app.waitForEvent('window');
    const empty = spawn(executable, ['.'], { cwd: process.cwd(), env, stdio: 'ignore' });
    const secondWindow = await opened;
    await expect(secondWindow.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await new Promise<number | null>(resolveExit => { if (empty.exitCode !== null) resolveExit(empty.exitCode); else empty.once('exit', resolveExit); })).toBe(0);
    await expect(page.locator('.document-tab')).toHaveCount(2);
    await expect(secondWindow.locator('.document-tab')).toHaveCount(0);
    expect(app.windows()).toHaveLength(2);
    const secondNative = await app.browserWindow(secondWindow); const secondId = await secondNative.evaluate(window => window.id);
    await secondWindow.bringToFront(); await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id)).toBe(secondId);
    const file = spawn(executable, ['.', first], { cwd: process.cwd(), env, stdio: 'ignore' });
    await expect(secondWindow.locator('.document-tab')).toContainText('first.bpmn');
    expect(await new Promise<number | null>(resolveExit => { if (file.exitCode !== null) resolveExit(file.exitCode); else file.once('exit', resolveExit); })).toBe(0);
    expect(app.windows()).toHaveLength(2);
    await expect(page.locator('.document-tab')).toHaveCount(2);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('новое окно из меню и Ctrl+Shift+N сохраняет работу исходного окна', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'desk-new-window-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(directory), ELECTRON_RENDERER_URL: '' } });
  try {
    const first = await app.firstWindow(); await createDiagram(first, 'Flowable');
    await first.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
    await first.getByLabel('Название', { exact: true }).fill('Работа в первом окне'); await first.getByLabel('Название', { exact: true }).blur();
    const menu = await app.evaluate(({ Menu }) => {
      const root = Menu.getApplicationMenu()!;
      return { label: root.getMenuItemById('new-window')!.label, shortcut: root.getMenuItemById('new-window')!.accelerator,
        exports: ['export', 'export-png', 'export-png-transparent', 'save-as'].map(id => root.getMenuItemById(id)!.label) };
    });
    expect(menu).toEqual({ label: 'Новое окно', shortcut: 'CmdOrCtrl+Shift+N', exports: ['Экспорт SVG…', 'Экспорт PNG с белым фоном…', 'Экспорт PNG с прозрачным фоном…', 'Сохранить как…'] });
    const secondOpened = app.waitForEvent('window'); await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('new-window')!.click());
    const second = await secondOpened; await expect(second.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(second.locator('.document-tab')).toHaveCount(0);
    await expect(first.getByLabel('Название', { exact: true })).toHaveValue('Работа в первом окне');
    await expect(first.locator('.dirty-dot')).toHaveCount(1);
    await second.evaluate(() => window.desktop!.setLanguage('en'));
    await expect.poll(() => app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('new-window')!.label)).toBe('New window');
    const secondNative = await app.browserWindow(second); const secondId = await secondNative.evaluate(window => window.id);
    await second.bringToFront(); await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id)).toBe(secondId);
    const thirdOpened = app.waitForEvent('window', { timeout: 7000 });
    await secondNative.evaluate(window => window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'N', modifiers: ['control', 'shift'] }));
    const third = await thirdOpened; await expect(third.getByRole('heading', { level: 1 })).toBeVisible();
    expect(app.windows()).toHaveLength(3); await expect(second.locator('.document-tab')).toHaveCount(0);
    await expect(first.locator('.dirty-dot')).toHaveCount(1);
    await third.close(); await expect.poll(() => app.windows().length).toBe(2);
    await expect(first.locator('.dirty-dot')).toHaveCount(1);
  } finally { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); await app.close(); await rm(directory, { recursive: true, force: true }); }
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
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false }); });
    await field.fill('${secondEdit}'); await field.blur();
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.locator('.dirty-dot.conflict')).toBeVisible();
    expect(await readFile(path, 'utf8')).toBe('<external-edit/>');
    // Отключаем диалог закрытия только в тестовом main process.
    await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('закрытие окна завершает редактирование поля и сохраняет восстанавливаемую модель с расширениями', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-close-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(directory), ELECTRON_RENDERER_URL: '' } });
  try {
    const counter = await app.evaluateHandle(({ dialog }) => {
      const state = { count: 0 };
      dialog.showMessageBoxSync = () => { state.count++; return 0; };
      return state;
    });
    const page = await app.firstWindow();
    await openExample(page, 'flowable-showcase');
    await page.getByRole('textbox', { name: 'Найти элемент' }).fill('prepareDocument');
    await page.locator('.outline-item').first().click();
    await page.getByLabel('Выражение делегата', { exact: true }).fill('${focusedEdit}');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
    await expect(page.getByLabel('Несохранённые изменения')).toBeVisible();
    await expect.poll(() => counter.evaluate(state => state.count)).toBe(1);
    const ids = JSON.parse(await readFile(resolve(directory, 'sessions/index.json'), 'utf8')) as string[];
    const session = JSON.parse(await readFile(resolve(directory, 'sessions', `${ids[0]}.json`), 'utf8'));
    expect(session.documents[0].xml).toContain('${focusedEdit}'); expect(session.documents[0].guardXml).toContain('${focusedEdit}');
    await page.reload(); await page.getByRole('button', { name: 'Восстановить', exact: true }).click();
    const path = resolve(directory, 'restored.bpmn');
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path);
    await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Сохранено'); expect(await readFile(path, 'utf8')).toContain('${focusedEdit}');
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
    await expect(page.getByRole('button', { name: 'Create diagram', exact: true })).toBeVisible();
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-menu')!.label)).toBe('Language');
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-ru')!.click());
    await expect(page.getByRole('button', { name: 'Создать схему', exact: true })).toBeVisible();
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-menu')!.label)).toBe('Язык');
    await selectOption(page.getByRole('combobox', { name: 'Язык', exact: true }), 'en');
    await expect(page.getByRole('button', { name: 'Create diagram', exact: true })).toBeVisible();
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-ru')!.click());
    await expect(page.getByRole('button', { name: 'Создать схему', exact: true })).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.sendInputEvent({ type: 'keyDown', keyCode: '=', modifiers: ['control'] }));
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.webContents.getZoomFactor())).toBeCloseTo(1.1);
    expect(JSON.parse(await readFile(resolve(directory, 'language.json'), 'utf8'))).toBe('ru');
    await app.close();
    app = await electron.launch({ args: ['.'], chromiumSandbox: true, env });
    await expect((await app.firstWindow()).getByRole('button', { name: 'Создать схему', exact: true })).toBeVisible();
    expect(await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('language-ru')!.checked)).toBe(true);
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('новая вкладка открывает примеры и свежие недавние файлы, повторное открытие сохраняет черновик', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-library-')); const path = resolve(directory, 'recent.bpmn');
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: await russianProfile(resolve(directory, 'profile')), ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow(); await page.getByTitle('Новая вкладка (Ctrl+N)', { exact: true }).click();
    await createDiagram(page, 'Flowable');
    await expect(page.locator('.outline-item').first()).toBeVisible();
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path);
    await page.getByTitle('Сохранить (Ctrl+S)', { exact: true }).click(); await expect(page.getByRole('status')).toContainText('recent.bpmn');
    const canonical = await realpath(path);
    expect(await page.evaluate(() => window.desktop!.recentFiles())).toEqual([canonical]);
    await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click();
    await page.locator('.document-workspace:visible').getByLabel('Название', { exact: true }).fill('Несохранённый черновик'); await page.locator('.document-workspace:visible').getByLabel('Название', { exact: true }).blur();
    await page.locator('.new-tab').click(); const dialog = page.locator('.welcome');
    await dialog.getByRole('region', { name: 'Недавние файлы' }).getByRole('button', { name: 'recent.bpmn', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toContainText(canonical);
    await openExample(page, 'camunda7-showcase'); await expect(page.locator('.document-tab')).toHaveCount(2);
    await page.locator('.new-tab').click(); await dialog.getByRole('region', { name: 'Недавние файлы' }).getByRole('button', { name: 'recent.bpmn', exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(page.locator('.document-tab')).toHaveCount(2);
    await expect(page.locator('.document-tab').first().getByRole('tab')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.document-workspace:visible').getByLabel('Название', { exact: true })).toHaveValue('Несохранённый черновик');
    await rm(path); await page.locator('.new-tab').click(); await dialog.getByRole('region', { name: 'Недавние файлы' }).getByRole('button', { name: 'recent.bpmn', exact: true }).click();
    await expect(dialog).toBeVisible(); await expect(page.getByRole('alert')).toContainText('recent.bpmn');
    await page.locator('.document-tab[data-kind=document]').first().getByRole('tab').click();
    await expect(page.locator('.document-workspace:visible').getByLabel('Название', { exact: true })).toHaveValue('Несохранённый черновик');
  } finally { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('отмена выбора файла оставляет стартовую вкладку, открытие файла заменяет её и сохраняет соседний черновик', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-start-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: resolve(directory, 'profile'), ELECTRON_RENDERER_URL: '' } });
  try {
    await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
    const page = await app.firstWindow(); await createDiagram(page, 'Flowable');
    await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click(); await page.getByLabel('Name', { exact: true }).fill('Preserved draft'); await page.getByLabel('Name', { exact: true }).blur();
    await page.locator('.new-tab').click();
    await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); });
    await page.getByRole('button', { name: 'Open diagram', exact: true }).click();
    await expect(page.locator('.document-tab[data-kind=home]')).toHaveCount(1); await expect(page.locator('.document-tab')).toHaveCount(2);
    await app.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); }, resolve('examples/camunda7-showcase.bpmn20.xml'));
    await page.getByRole('button', { name: 'Open diagram', exact: true }).click();
    await expect(page.locator('.engine-badge')).toHaveText('Camunda 7'); await expect(page.locator('.document-tab[data-kind=home]')).toHaveCount(0); await expect(page.locator('.document-tab')).toHaveCount(2);
    await page.locator('.document-tab').first().getByRole('tab').click(); await expect(page.locator('.document-workspace:visible').getByLabel('Name', { exact: true })).toHaveValue('Preserved draft');
  } finally { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('сессия восстанавливает точный снимок чистого файла, показывает внешний статус и перезагружается из меню', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'desk-session-disk-')); const path = resolve(directory, 'process.bpmn');
  await copyFile('examples/flowable-vacation-request.bpmn20.xml', path);
  const original = await readFile(path, 'utf8'); const env = { ...process.env, BPMN_DESK_USER_DATA: resolve(directory, 'profile'), ELECTRON_RENDERER_URL: '' };
  let app = await electron.launch({ args: ['.', path], chromiumSandbox: true, env });
  try {
    let page = await app.firstWindow(); await expect(page.locator('.outline-item').first()).toBeVisible();
    await expect.poll(async () => (await page.evaluate(() => window.desktop!.sessions())).length).toBe(1);
    await app.close(); await writeFile(path, original.replace('name="Vacation request"', 'name="External revision"'));
    app = await electron.launch({ args: ['.'], chromiumSandbox: true, env }); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Restore', exact: true }).click();
    await expect(page.locator('.dirty-dot.external')).toBeVisible();
    await expect(page.locator('.outline-item').filter({ hasText: 'External revision' })).toHaveCount(0);
    await page.locator('.document-tab').hover(); await expect(page.getByRole('tooltip')).toContainText('changed on disk');
    await page.locator('.document-tab').click({ button: 'right' }); await page.getByRole('menuitem', { name: 'Reload from disk', exact: true }).click();
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
    await expect(page.locator('.outline-item').filter({ hasText: 'External revision' })).toBeVisible();
    await rm(path); await expect(page.locator('.dirty-dot.external')).toBeVisible({ timeout: 6000 });
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 2, checkboxChecked: false }); });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.dirty-dot')).toHaveCount(0); expect(await readFile(path, 'utf8')).toContain('External revision');
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('конфликт сохранения предлагает отмену, отдельную копию и явную перезапись; повреждённый XML сохраняет холст', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'desk-conflict-ui-')); const path = resolve(directory, 'process.bpmn'); const copy = resolve(directory, 'copy.bpmn');
  await copyFile('examples/flowable-showcase.bpmn20.xml', path);
  const app = await electron.launch({ args: ['.', path], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: resolve(directory, 'profile'), ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow(); await expect(page.locator('.outline-item').first()).toBeVisible();
    await page.getByLabel('Find element').fill('prepareDocument'); await page.locator('.outline-item').first().click();
    await page.getByLabel('Delegate expression', { exact: true }).fill('${localEdit}'); await page.getByLabel('Delegate expression', { exact: true }).blur();
    await writeFile(path, '<broken>'); await expect(page.locator('.dirty-dot.conflict')).toBeVisible({ timeout: 6000 });
    page.once('dialog', dialog => dialog.accept());
    await page.locator('.document-tab').click({ button: 'right' }); await page.getByRole('menuitem', { name: 'Reload from disk', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByLabel('Delegate expression', { exact: true })).toHaveValue('${localEdit}');
    await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false }); });
    await page.getByRole('button', { name: 'Save', exact: true }).click(); expect(await readFile(path, 'utf8')).toBe('<broken>');
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showMessageBox = async (_window, options?: import('electron').MessageBoxOptions) => { if (options?.buttons?.join('|') !== 'Cancel|Save as…|Overwrite file') throw new Error('Wrong conflict actions'); return { response: 1, checkboxChecked: false }; };
      dialog.showSaveDialog = async () => ({ canceled: false, filePath });
    }, copy);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('.document-tab')).toContainText('copy.bpmn'); expect(await readFile(path, 'utf8')).toBe('<broken>'); expect(await readFile(copy, 'utf8')).toContain('${localEdit}');
    await writeFile(copy, '<external>'); await app.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 2, checkboxChecked: false }); });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => readFile(copy, 'utf8')).toContain('${localEdit}');
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
  } finally { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('восстановление в занятом окне открывает другое окно, команды и файловые разрешения изолированы', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'desk-windows-')); const path = resolve(directory, 'shared.bpmn');
  await copyFile('examples/flowable-vacation-request.bpmn20.xml', path);
  const app = await electron.launch({ args: ['.', path], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: resolve(directory, 'profile'), ELECTRON_RENDERER_URL: '' } });
  try {
    await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
    const first = await app.firstWindow(); await expect(first.locator('.outline-item').first()).toBeVisible();
    await expect.poll(async () => (await first.evaluate(() => window.desktop!.sessions())).length).toBe(1);
    const previous = (await first.evaluate(() => window.desktop!.sessions()))[0]!.id;
    await first.reload(); await createDiagram(first, 'Camunda 7');
    await expect.poll(async () => (await first.evaluate(() => window.desktop!.sessions())).length).toBe(2);
    const opened = app.waitForEvent('window'); await first.evaluate(id => window.desktop!.restoreSession(id, true), previous);
    const second = await opened; await expect(second.locator('.document-tab')).toContainText('shared.bpmn');
    await expect(first.locator('.engine-badge')).toHaveText('Camunda 7');
    await expect(second.locator('.outline-item').first()).toBeVisible();
    expect(app.windows()).toHaveLength(2);
    const connection = await first.evaluate(() => window.runtime!.saveConnection({ name: 'Shared connection', engine: 'flowable', baseUrl: 'http://127.0.0.1:19099/flowable-rest/service', authentication: 'basic', username: 'demo', secret: 'test-only-secret', rememberSecret: false }));
    expect((await second.evaluate(() => window.runtime!.connections())).items).toContainEqual(expect.objectContaining({ id: connection.id, hasSecret: true, secretStored: false }));
    await first.evaluate(id => window.runtime!.deleteConnection(id), connection.id);
    expect((await second.evaluate(() => window.runtime!.connections())).items).toHaveLength(0);
    await first.getByRole('button', { name: 'Dark theme', exact: true }).click(); await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
    await first.evaluate(() => window.desktop!.setLanguage('ru')); await expect(second.locator('html')).toHaveAttribute('lang', 'ru');
    await first.evaluate(() => window.desktop!.setLanguage('en')); await expect(second.locator('html')).toHaveAttribute('lang', 'en');
    const token = await second.evaluate(async id => (await window.desktop!.restoreSession(id))?.documents[0]?.token, previous);
    expect(token).toBeTruthy();
    await expect(first.evaluate(token => window.desktop!.reloadFile(token!), token)).rejects.toThrow('не был открыт');
    expect(await first.evaluate(id => window.desktop!.restoreSession(id, true), previous)).toBeNull();
    expect(app.windows()).toHaveLength(2);
    await first.evaluate(async path => {
      const file = await window.desktop!.openRecent(path);
      await window.desktop!.saveFile({ token: file.token, name: file.name, content: file.xml.replace('name="Vacation request"', 'name="Updated from another window"') });
    }, await realpath(path));
    await expect(second.locator('.dirty-dot.external')).toBeVisible({ timeout: 6000 });
    const secondWindow = await app.browserWindow(second); const secondId = await secondWindow.evaluate(window => window.id);
    await second.bringToFront(); await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.id)).toBe(secondId);
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('new-diagram')!.click());
    await expect(second.locator('.document-tab[data-kind=home]')).toHaveCount(1);
    await expect(first.locator('.document-tab')).toHaveCount(1);
    await createDiagram(second, 'BPMN 2.0'); await expect(second.locator('.document-tab')).toHaveCount(2);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getFocusedWindow()?.close());
    await expect.poll(() => app.windows().length).toBe(1); await expect(first.locator('.engine-badge')).toHaveText('Camunda 7');
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('native меню правки копирует фигуры между вкладками и отменяет вставку в целевом документе', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'desk-edit-menu-'));
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: directory, ELECTRON_RENDERER_URL: '' } });
  try {
    await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; });
    const page = await app.firstWindow(); await openExample(page, 'flowable-showcase');
    await page.getByLabel('Find element').fill('prepareDocument'); await page.locator('.outline-item').first().click();
    await page.locator('.bpmn-container .djs-container > svg').focus();
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('copy')!.click());
    await page.locator('.new-tab').click(); await createDiagram(page, 'BPMN 2.0');
    await expect(page.locator('.engine-badge')).toHaveText('BPMN 2.0');
    const canvas = page.locator('.document-workspace:visible .bpmn-container .djs-container > svg'); await expect(canvas).toBeVisible(); await canvas.focus();
    const box = (await canvas.boundingBox())!; await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.35);
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('paste')!.click());
    await expect(page.locator('.djs-drag-group')).toBeAttached();
    await page.mouse.move(box.x + box.width * 0.65 + 20, box.y + box.height * 0.35 + 20);
    await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.35);
    await expect(page.locator('.document-workspace:visible .outline-item[title^="bpmn:ServiceTask"]')).toHaveCount(1);
    await app.evaluate(({ Menu }) => Menu.getApplicationMenu()!.getMenuItemById('undo')!.click());
    await expect(page.locator('.document-workspace:visible .outline-item[title^="bpmn:ServiceTask"]')).toHaveCount(0);
    await page.locator('.document-tab').first().getByRole('tab').click(); await expect(page.getByLabel('Delegate expression', { exact: true })).toHaveValue('${prepareDocumentDelegate}');
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('ошибка записи сессии при закрытии явно предупреждает и позволяет остаться в окне', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'bpmn-desk-session-error-')); const profile = resolve(directory, 'profile');
  const app = await electron.launch({ args: ['.'], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: profile, ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow(); await createDiagram(page, 'Flowable');
    const index = resolve(profile, 'sessions/index.json');
    await expect.poll(async () => { try { return JSON.parse(await readFile(index, 'utf8')).length; } catch { return 0; } }).toBe(1);
    await rm(index); await mkdir(index);
    await page.locator('.outline-item').filter({ hasText: 'Process_1' }).click(); await page.getByLabel('Name', { exact: true }).fill('Keep this work'); await page.getByLabel('Name', { exact: true }).blur();
    await app.evaluate(({ BrowserWindow, dialog }) => {
      dialog.showMessageBoxSync = (windowOrOptions: Electron.BaseWindow | Electron.MessageBoxSyncOptions, options?: Electron.MessageBoxSyncOptions) => { process.env.BPMN_DESK_CLOSE_TEST = JSON.stringify(options ?? windowOrOptions); return 0; };
      BrowserWindow.getAllWindows()[0]!.close();
    });
    await expect.poll(() => app.evaluate(() => process.env.BPMN_DESK_CLOSE_TEST ?? '')).toContain('Could not save the session.');
    const options = JSON.parse(await app.evaluate(() => process.env.BPMN_DESK_CLOSE_TEST!));
    expect(options.buttons).toEqual(['Return', 'Close without saving the session']); expect(options.defaultId).toBe(0);
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Keep this work');
    await rm(index, { recursive: true }); await page.getByLabel('Name', { exact: true }).fill('Saved after retry'); await page.getByLabel('Name', { exact: true }).blur();
    await expect.poll(async () => { try { return JSON.parse(await readFile(index, 'utf8')).length; } catch { return 0; } }).toBe(1);
  } finally { await app.evaluate(({ dialog }) => { dialog.showMessageBoxSync = () => 1; }); await app.close(); await rm(directory, { recursive: true, force: true }); }
});

test('сохранение копии поверх открытого файла оставляет внешнее изменение у исходной вкладки', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'desk-copy-conflict-')); const path = resolve(directory, 'shared.bpmn');
  await copyFile('examples/flowable-vacation-request.bpmn20.xml', path);
  const app = await electron.launch({ args: ['.', path], chromiumSandbox: true, env: { ...process.env, BPMN_DESK_USER_DATA: resolve(directory, 'profile'), ELECTRON_RENDERER_URL: '' } });
  try {
    const page = await app.firstWindow(); await expect(page.locator('.outline-item').first()).toBeVisible();
    await app.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false }); }, path);
    const xml = (await readFile(path, 'utf8')).replace('name="Vacation request"', 'name="Saved copy"');
    await page.evaluate(content => window.desktop!.saveFile({ name: 'copy.bpmn', content, saveAs: true }), xml);
    await expect(page.locator('.dirty-dot.external')).toBeVisible({ timeout: 6000 });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect(await readFile(path, 'utf8')).toBe(xml); await expect(page.locator('.dirty-dot.external')).toBeVisible();
  } finally { await app.close(); await rm(directory, { recursive: true, force: true }); }
});
