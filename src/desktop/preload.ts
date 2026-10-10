import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { channels, type DesktopBridge } from '../shared/contracts';
import type { Language } from '../shared/i18n';
import { runtimeBridge } from './runtime/preload';
const bridge: DesktopBridge = {
  language: () => ipcRenderer.invoke(channels.language),
  setLanguage: language => ipcRenderer.invoke(channels.setLanguage, language),
  onLanguage: callback => {
    const listener = (_event: Electron.IpcRendererEvent, language: Language) => callback(language);
    ipcRenderer.on(channels.languageChanged, listener);
    return () => { ipcRenderer.removeListener(channels.languageChanged, listener); };
  },
  initialFiles: () => ipcRenderer.invoke(channels.initial),
  onFiles: callback => {
    const listener = (_event: Electron.IpcRendererEvent, files: import('../shared/contracts').OpenedFile[]) => callback(files);
    ipcRenderer.on(channels.opened, listener);
    return () => { ipcRenderer.removeListener(channels.opened, listener); };
  },
  openFiles: () => ipcRenderer.invoke(channels.open),
  openDropped: files => ipcRenderer.invoke(channels.drop, files.map(file => webUtils.getPathForFile(file))),
  openRecent: path => ipcRenderer.invoke(channels.openRecent, path),
  recentFiles: () => ipcRenderer.invoke(channels.recent),
  examples: () => ipcRenderer.invoke(channels.examples),
  openExample: name => ipcRenderer.invoke(channels.example, name),
  saveFile: request => ipcRenderer.invoke(channels.save, request),
  setDirty: dirty => ipcRenderer.send(channels.dirty, dirty),
  closeReady: dirty => ipcRenderer.send(channels.closeReady, dirty),
  onAction: callback => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on(channels.action, listener);
    return () => { ipcRenderer.removeListener(channels.action, listener); };
  },
};
contextBridge.exposeInMainWorld('desktop', bridge);
contextBridge.exposeInMainWorld('runtime', runtimeBridge((channel, ...args) => ipcRenderer.invoke(channel, ...args)));
