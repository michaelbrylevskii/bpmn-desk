import type { Language } from './i18n';

export interface OpenedFile {
  token: string;
  name: string;
  path: string;
  xml: string;
}

export interface SaveRequest {
  token?: string;
  name: string;
  content: string;
  saveAs?: boolean;
  format?: 'bpmn' | 'svg';
}

export interface SavedFile {
  token: string;
  name: string;
  path: string;
}

export interface DesktopBridge {
  language(): Promise<Language>;
  setLanguage(language: Language): Promise<void>;
  onLanguage(callback: (language: Language) => void): () => void;
  initialFiles(): Promise<OpenedFile[]>;
  onFiles(callback: (files: OpenedFile[]) => void): () => void;
  openFiles(): Promise<OpenedFile[]>;
  openDropped(files: File[]): Promise<OpenedFile[]>;
  openRecent(path: string): Promise<OpenedFile>;
  recentFiles(): Promise<string[]>;
  examples(): Promise<string[]>;
  openExample(name: string): Promise<OpenedFile>;
  saveFile(request: SaveRequest): Promise<SavedFile | null>;
  setDirty(dirty: boolean): void;
  closeReady(dirty: boolean): void;
  onAction(callback: (action: string) => void): () => void;
}

export const channels = {
  language: 'settings:language', setLanguage: 'settings:set-language', languageChanged: 'settings:language-changed',
  open: 'documents:open', drop: 'documents:drop', recent: 'documents:recent',
  openRecent: 'documents:open-recent', examples: 'documents:examples',
  example: 'documents:example', save: 'documents:save', dirty: 'documents:dirty',
  action: 'application:action',
  initial: 'documents:initial', opened: 'documents:opened',
  closeReady: 'application:close-ready',
} as const;
