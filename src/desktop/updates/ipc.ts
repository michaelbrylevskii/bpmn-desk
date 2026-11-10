import { shell, type BrowserWindow } from 'electron';
import { updateChannels } from '../../shared/updates';
import { windowIpc } from '../window-ipc';
import { releasesPage, type UpdateChecker } from './checker';

export function registerUpdateIpc(window: BrowserWindow, updates: UpdateChecker): void {
  const ipc = windowIpc(window);
  ipc.handle(updateChannels.status, () => updates.status());
  ipc.handle(updateChannels.check, () => updates.checkNow());
  ipc.handle(updateChannels.openRelease, async () => {
    if (updates.status().availableVersion) await shell.openExternal(releasesPage);
  });
  const unsubscribe = updates.subscribe(status => {
    if (!window.webContents.isDestroyed()) window.webContents.send(updateChannels.changed, status);
  });
  window.once('closed', unsubscribe);
}
