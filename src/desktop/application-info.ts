import { app, shell, type BrowserWindow } from 'electron';
import { applicationChannels, type ApplicationInfo } from '../shared/application-info';
import { windowIpc } from './window-ipc';

const links = {
  repository: 'https://github.com/michaelbrylevskii/bpmn-desk',
  author: 'https://github.com/michaelbrylevskii',
} as const;

export function registerApplicationInfo(window: BrowserWindow): void {
  const ipc = windowIpc(window);
  ipc.handle(applicationChannels.info, (): ApplicationInfo => ({
    version: app.getVersion(), electron: process.versions.electron, chromium: process.versions.chrome,
    node: process.versions.node, platform: process.platform, arch: process.arch,
  }));
  ipc.handle(applicationChannels.openLink, async (_event, value: unknown) => {
    if (value !== 'repository' && value !== 'author') throw new Error('Недопустимая ссылка.');
    await shell.openExternal(links[value]);
  });
}
