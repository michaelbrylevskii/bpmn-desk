import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { defaultLanguage, translate, translateText, type Language, type Translator } from '../../shared/i18n';
import { bridge } from '../platform/bridge';

interface Locale { language: Language; t: Translator; text: (value: string) => string; setLanguage: (value: Language) => Promise<void> }
const Context = createContext<Locale>({ language: defaultLanguage, t: (key, parameters) => translate(defaultLanguage, key, parameters), text: value => translateText(defaultLanguage, value), setLanguage: async () => undefined });

export function LanguageProvider({ initial, children }: { initial: Language; children: ReactNode }) {
  const [language, set] = useState(initial);
  useEffect(() => {
    let active = true; let revision = 0;
    const unsubscribe = bridge.onLanguage(value => { revision++; set(value); });
    // Согласуем начальный snapshot с выбором в native меню во время загрузки UI.
    void bridge.language().then(value => { if (active && revision === 0) set(value); }).catch(() => undefined);
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback(async (value: Language) => { await bridge.setLanguage(value); set(value); }, []);
  const value = useMemo<Locale>(() => ({ language, t: (key, parameters) => translate(language, key, parameters), text: value => translateText(language, value), setLanguage }), [language, setLanguage]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useI18n = (): Locale => useContext(Context);
