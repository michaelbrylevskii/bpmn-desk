import type { DesktopBridge, OpenedFile } from '../../shared/contracts';
import { defaultLanguage, isLanguage, languageKey, type Language } from '../../shared/i18n';
declare global { interface Window { desktop?: DesktopBridge } }

const bundledExamples = import.meta.glob<string>('/examples/*.bpmn20.xml', { query: '?raw', import: 'default', eager: true });

async function browserFiles(files: File[]): Promise<OpenedFile[]> {
  return Promise.all(files.map(async file => ({ token: '', path: '', name: file.name, xml: await file.text() })));
}

/** Браузерный адаптер предназначен для preview и E2E; desktop использует preload. */
const languageListeners = new Set<(value: Language) => void>();
const browserBridge: DesktopBridge = {
  language: () => { const stored = localStorage.getItem(languageKey); return Promise.resolve(isLanguage(stored) ? stored : defaultLanguage); },
  setLanguage: async value => { if (!isLanguage(value)) throw new Error('Недопустимый язык интерфейса.'); localStorage.setItem(languageKey, value); for (const listener of languageListeners) listener(value); },
  onLanguage: callback => { languageListeners.add(callback); return () => { languageListeners.delete(callback); }; },
  initialFiles: () => Promise.resolve([]),
  onFiles: () => () => undefined,
  openFiles: () => new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.bpmn,.xml'; input.multiple = true;
    input.addEventListener('change', () => { void browserFiles(Array.from(input.files ?? [])).then(resolve); });
    input.addEventListener('cancel', () => resolve([]));
    input.click();
  }),
  openDropped: browserFiles,
  openRecent: () => Promise.reject(new Error('Недавние локальные файлы доступны в desktop-приложении.')),
  recentFiles: () => Promise.resolve([]),
  examples: () => Promise.resolve(Object.keys(bundledExamples).map(key => key.split('/').pop() ?? key)),
  openExample: name => {
    const xml = bundledExamples[`/examples/${name}`];
    return xml ? Promise.resolve({ token: '', path: '', name, xml }) : Promise.reject(new Error('Неизвестный пример.'));
  },
  saveFile: request => {
    const url = URL.createObjectURL(new Blob([request.format === 'png' ? new Uint8Array(request.content).buffer : request.content], { type: request.format === 'png' ? 'image/png' : request.format === 'svg' ? 'image/svg+xml' : 'application/xml' }));
    const link = document.createElement('a'); link.href = url; link.download = request.name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return Promise.resolve({ token: '', path: '', name: request.name });
  },
  setDirty: () => undefined,
  closeReady: () => undefined,
  onAction: () => () => undefined,
};

export const bridge: DesktopBridge = window.desktop ?? browserBridge;
