import type { MenuState } from '../shared/menu';
import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { channels } from '../shared/contracts';
import { translate, type Language, type MessageKey } from '../shared/i18n';

/** Перестроение меню не пересоздаёт окно, модель или обработчики масштаба. */
export function applicationMenu(window: BrowserWindow, language: Language, zoom: MenuItemConstructorOptions[], changeLanguage: (value: Language) => void, newWindow: () => void): void {
  const t = (key: MessageKey) => translate(language, key);
  const action = (name: string) => () => window.webContents.send(channels.action, name);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: t('Файл'), submenu: [
      { id: 'new-diagram', label: t('Новая вкладка'), accelerator: 'CmdOrCtrl+N', click: action('new') },
      { id: 'new-window', label: t('Новое окно'), accelerator: 'CmdOrCtrl+Shift+N', click: newWindow },
      { label: t('Открыть…'), accelerator: 'CmdOrCtrl+O', click: action('open') },
      { id: 'save', label: t('Сохранить'), accelerator: 'CmdOrCtrl+S', click: action('save') },
      { id: 'save-as', label: t('Сохранить как…'), accelerator: 'CmdOrCtrl+Shift+S', click: action('save-as') },
      { id: 'reload', label: t('Перезагрузить с диска'), click: action('reload') },
      { id: 'reveal', label: t('Показать файл в папке'), click: action('reveal') },
      { type: 'separator' },
      { id: 'export', label: t('Экспорт SVG…'), click: action('export') },
      { id: 'export-png', label: t('Экспорт PNG с белым фоном…'), click: action('export-png') },
      { id: 'export-png-transparent', label: t('Экспорт PNG с прозрачным фоном…'), click: action('export-png-transparent') },
      { type: 'separator' }, { label: t('Подключения…'), click: action('connections') },
      { type: 'separator' }, { role: 'quit', label: t('Выход') },
    ] },
    { label: t('Правка'), submenu: [
      { id: 'undo', label: t('Отменить'), accelerator: 'CmdOrCtrl+Z', click: action('undo') },
      { id: 'redo', label: t('Повторить'), accelerator: 'CmdOrCtrl+Shift+Z', click: action('redo') },
      { type: 'separator' }, { id: 'cut', label: t('Вырезать'), accelerator: 'CmdOrCtrl+X', click: action('cut') }, { id: 'copy', label: t('Копировать'), accelerator: 'CmdOrCtrl+C', click: action('copy') }, { id: 'paste', label: t('Вставить'), accelerator: 'CmdOrCtrl+V', click: action('paste') }, { id: 'selectAll', label: t('Выделить всё'), accelerator: 'CmdOrCtrl+A', click: action('selectAll') },
    ] },
    { label: t('Вкладки'), submenu: [
      { id: 'duplicate', label: t('Дублировать схему'), click: action('duplicate') },
      { id: 'close-tab', label: t('Закрыть'), accelerator: 'CmdOrCtrl+W', click: action('close-tab') },
      { id: 'close-all', label: t('Закрыть все вкладки'), click: action('close-all') },
    ] },
    { label: t('Навигация'), submenu: [
      { id: 'browser-backward', label: t('Назад'), accelerator: 'Alt+Left', click: action('browser-backward') },
      { id: 'browser-forward', label: t('Вперёд'), accelerator: 'Alt+Right', click: action('browser-forward') },
      { id: 'refresh', label: t('Обновить'), click: action('refresh') },
      { id: 'auto-refresh', label: t('Автообновление'), type: 'checkbox', click: action('auto-refresh') },
      { id: 'summary', label: t('Сводка'), type: 'checkbox', click: action('summary') },
    ] },
    { label: t('Вид'), submenu: [...zoom, { type: 'separator' },
      { id: 'fit', label: t('Вписать схему'), accelerator: 'CmdOrCtrl+Shift+0', click: action('fit') }, { role: 'togglefullscreen', label: t('Полный экран') },
    ] },
    { id: 'language-menu', label: t('Язык'), submenu: [
      { id: 'language-en', label: 'English', type: 'radio', checked: language === 'en', click: () => changeLanguage('en') },
      { id: 'language-ru', label: 'Русский', type: 'radio', checked: language === 'ru', click: () => changeLanguage('ru') },
    ] },
  ]));
  if (process.platform !== 'darwin') window.setMenuBarVisibility(false);
}

/** Доступность меняется без пересоздания меню и потери фокуса ввода. */
export function updateApplicationMenu(state: MenuState): void {
  const menu = Menu.getApplicationMenu();
  const enabled: Record<string, boolean> = {
    save: state.document, 'save-as': state.document, reload: state.localFile, reveal: state.localFile,
    duplicate: state.document, 'close-tab': state.tabs, 'close-all': state.tabs,
    undo: state.canUndo, redo: state.canRedo,
    export: state.canExport, 'export-png': state.canExport, 'export-png-transparent': state.canExport, fit: state.document || state.monitor,
    'browser-backward': state.monitor && state.back, 'browser-forward': state.monitor && state.forward,
    refresh: state.monitor && state.canRefresh, 'auto-refresh': state.monitor, summary: state.monitor,
  };
  for (const [id, value] of Object.entries(enabled)) { const item = menu?.getMenuItemById(id); if (item) item.enabled = value; }
  const auto = menu?.getMenuItemById('auto-refresh'); if (auto) auto.checked = state.auto;
  const summary = menu?.getMenuItemById('summary'); if (summary) summary.checked = state.summary;
}
