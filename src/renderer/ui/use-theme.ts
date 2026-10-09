import { useEffect, useLayoutEffect, useState } from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';
const STORAGE_KEY = 'bpmn-desk:theme';
const SYSTEM_QUERY = '(prefers-color-scheme: dark)';

/** Настройка UI; в документ и command stack не попадает. Старые light/dark совместимы. */
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'auto';
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(SYSTEM_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(SYSTEM_QUERY);
    const changed = () => setSystemDark(media.matches);
    changed();
    media.addEventListener('change', changed);
    return () => media.removeEventListener('change', changed);
  }, []);
  const dark = mode === 'dark' || (mode === 'auto' && systemDark);
  useLayoutEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, mode); }, [mode]);
  return { mode, dark, setMode };
}
