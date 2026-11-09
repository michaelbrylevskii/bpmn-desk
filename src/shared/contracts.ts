export type WorkspaceChange = 'sessions' | 'recent' | 'connections';
import type { MenuState } from './menu';
import type { SessionOverview, WorkspaceSession } from './sessions';
import type { Language } from './i18n';

export interface OpenedFile {
  token: string;
  name: string;
  path: string;
  xml: string;
}

export type FileState = 'unchanged' | 'changed' | 'missing' | 'unavailable';
export interface FileStatus { token: string; state: FileState; revision?: string; error?: string }

interface SaveOptions {
  token?: string;
  name: string;
  saveAs?: boolean;
}
export type SaveRequest = SaveOptions & ({ content: string; format?: 'bpmn' | 'svg' } | { content: Uint8Array; format: 'png' });
export type DiagramExport = 'svg' | 'png-white' | 'png-transparent';

export interface SavedFile {
  token: string;
  name: string;
  path: string;
  revealToken?: string;
}

export interface DesktopBridge {
  initialSession(): Promise<string | null>;
  onWorkspaceChanged(callback: (kind: WorkspaceChange) => void): () => void;
  sessions(): Promise<SessionOverview[]>;
  saveSession(session: WorkspaceSession): Promise<void>;
  restoreSession(id: string, newWindow?: boolean): Promise<WorkspaceSession | null>;
  dismissSession(id: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  setSessionPin(id: string, name: string | null): Promise<void>;
  language(): Promise<Language>;
  setLanguage(language: Language): Promise<void>;
  onLanguage(callback: (language: Language) => void): () => void;
  initialFiles(): Promise<OpenedFile[]>;
  onFiles(callback: (files: OpenedFile[]) => void): () => void;
  openFiles(): Promise<OpenedFile[]>;
  openDropped(files: File[]): Promise<OpenedFile[]>;
  openRecent(path: string): Promise<OpenedFile>;
  recentFiles(): Promise<string[]>;
  removeRecent(path: string): Promise<string[]>;
  fileStatuses(tokens: string[]): Promise<FileStatus[]>;
  reloadFile(token: string): Promise<OpenedFile>;
  revealFile(token: string): Promise<void>;
  revealExport(token: string): Promise<void>;
  examples(): Promise<string[]>;
  openExample(name: string): Promise<OpenedFile>;
  saveFile(request: SaveRequest): Promise<SavedFile | null>;
  editText(action: 'cut' | 'copy' | 'paste' | 'selectAll'): void;
  setMenuState(state: MenuState): void;
  setDirty(dirty: boolean): void;
  closeReady(dirty: boolean, sessionSaved?: boolean): void;
  onAction(callback: (action: string) => void): () => void;
}

export const channels = {
  sessionPin: 'sessions:pin',
  revealExport: 'exports:reveal',
  workspaceChanged: 'workspace:changed', initialSession: 'sessions:initial', sessions: 'sessions:list', saveSession: 'sessions:save', restoreSession: 'sessions:restore', dismissSession: 'sessions:dismiss', deleteSession: 'sessions:delete',
  language: 'settings:language', setLanguage: 'settings:set-language', languageChanged: 'settings:language-changed',
  statuses: 'documents:statuses', reload: 'documents:reload', reveal: 'documents:reveal', removeRecent: 'documents:remove-recent',
  open: 'documents:open', drop: 'documents:drop', recent: 'documents:recent',
  openRecent: 'documents:open-recent', examples: 'documents:examples',
  example: 'documents:example', save: 'documents:save', dirty: 'documents:dirty',
  editText: 'application:edit-text', menuState: 'application:menu-state', action: 'application:action',
  initial: 'documents:initial', opened: 'documents:opened',
  closeReady: 'application:close-ready',
} as const;
