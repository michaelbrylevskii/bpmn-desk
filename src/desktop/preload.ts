import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { channels, type DesktopBridge } from '../shared/contracts';
import type { Language } from '../shared/i18n';
import { runtimeBridge } from './runtime/preload';
import { updateChannels, type UpdatesBridge, type UpdateStatus } from '../shared/updates';
import { applicationChannels, type ApplicationBridge } from '../shared/application-info';
const bridge: DesktopBridge = {
  initialSession: () => ipcRenderer.invoke(channels.initialSession),
  onWorkspaceChanged: callback => {
    const listener = (_event: Electron.IpcRendererEvent, kind: import('../shared/contracts').WorkspaceChange) => callback(kind);
    ipcRenderer.on(channels.workspaceChanged, listener); return () => { ipcRenderer.removeListener(channels.workspaceChanged, listener); };
  },
  sessions: () => ipcRenderer.invoke(channels.sessions),
  saveSession: session => ipcRenderer.invoke(channels.saveSession, session),
  restoreSession: (id, newWindow) => ipcRenderer.invoke(channels.restoreSession, id, newWindow),
  dismissSession: id => ipcRenderer.invoke(channels.dismissSession, id),
  deleteSession: id => ipcRenderer.invoke(channels.deleteSession, id),
  setSessionPin: (id, name) => ipcRenderer.invoke(channels.sessionPin, id, name),
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
  removeRecent: path => ipcRenderer.invoke(channels.removeRecent, path),
  fileStatuses: tokens => ipcRenderer.invoke(channels.statuses, tokens),
  reloadFile: token => ipcRenderer.invoke(channels.reload, token),
  revealFile: token => ipcRenderer.invoke(channels.reveal, token),
  revealExport: token => ipcRenderer.invoke(channels.revealExport, token),
  recentFiles: () => ipcRenderer.invoke(channels.recent),
  examples: () => ipcRenderer.invoke(channels.examples),
  openExample: name => ipcRenderer.invoke(channels.example, name),
  saveFile: request => ipcRenderer.invoke(channels.save, request),
  editText: action => ipcRenderer.send(channels.editText, action),
  setMenuState: state => ipcRenderer.send(channels.menuState, state),
  setDirty: dirty => ipcRenderer.send(channels.dirty, dirty),
  closeReady: (dirty, sessionSaved = true) => ipcRenderer.send(channels.closeReady, dirty, sessionSaved),
  onAction: callback => {
    const listener = (_event: Electron.IpcRendererEvent, action: string) => callback(action);
    ipcRenderer.on(channels.action, listener);
    return () => { ipcRenderer.removeListener(channels.action, listener); };
  },
};
contextBridge.exposeInMainWorld('desktop', bridge);
contextBridge.exposeInMainWorld('runtime', runtimeBridge((channel, ...args) => ipcRenderer.invoke(channel, ...args)));
const updates: UpdatesBridge = {
  status: () => ipcRenderer.invoke(updateChannels.status),
  check: () => ipcRenderer.invoke(updateChannels.check),
  openRelease: () => ipcRenderer.invoke(updateChannels.openRelease),
  onChanged: callback => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status);
    ipcRenderer.on(updateChannels.changed, listener);
    return () => { ipcRenderer.removeListener(updateChannels.changed, listener); };
  },
};
contextBridge.exposeInMainWorld('updates', updates);
const application: ApplicationBridge = {
  info: () => ipcRenderer.invoke(applicationChannels.info),
  openLink: link => ipcRenderer.invoke(applicationChannels.openLink, link),
};
contextBridge.exposeInMainWorld('application', application);
