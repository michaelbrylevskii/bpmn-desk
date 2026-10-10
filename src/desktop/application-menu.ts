import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { channels } from '../shared/contracts';
import { translate, type Language, type MessageKey } from '../shared/i18n';

/** Перестроение меню не пересоздаёт окно, модель или обработчики масштаба. */
export function applicationMenu(window: BrowserWindow, language: Language, zoom: MenuItemConstructorOptions[], changeLanguage: (value: Language) => void): void {
  const t = (key: MessageKey) => translate(language, key);
  const action = (name: string) => () => window.webContents.send(channels.action, name);
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: t('Файл'), submenu: [
      { id: 'new-diagram', label: t('Новая схема'), accelerator: 'CmdOrCtrl+N', click: action('new') },
      { label: t('Открыть…'), accelerator: 'CmdOrCtrl+O', click: action('open') },
      { label: t('Сохранить'), accelerator: 'CmdOrCtrl+S', click: action('save') },
      { label: t('Сохранить как…'), accelerator: 'CmdOrCtrl+Shift+S', click: action('save-as') },
      { type: 'separator' }, { role: 'quit', label: t('Выход') },
    ] },
    { label: t('Правка'), submenu: [
      { label: t('Отменить'), accelerator: 'CmdOrCtrl+Z', click: action('undo') },
      { label: t('Повторить'), accelerator: 'CmdOrCtrl+Shift+Z', click: action('redo') },
      { type: 'separator' }, { role: 'cut', label: t('Вырезать') }, { role: 'copy', label: t('Копировать') }, { role: 'paste', label: t('Вставить') }, { role: 'selectAll', label: t('Выделить всё') },
    ] },
    { label: t('Вид'), submenu: [...zoom, { type: 'separator' },
      { label: t('Вписать схему'), accelerator: 'CmdOrCtrl+Shift+0', click: action('fit') }, { role: 'togglefullscreen', label: t('Полный экран') },
    ] },
    { id: 'language-menu', label: t('Язык'), submenu: [
      { id: 'language-en', label: 'English', type: 'radio', checked: language === 'en', click: () => changeLanguage('en') },
      { id: 'language-ru', label: 'Русский', type: 'radio', checked: language === 'ru', click: () => changeLanguage('ru') },
    ] },
  ]));
  if (process.platform !== 'darwin') window.setMenuBarVisibility(false);
}
