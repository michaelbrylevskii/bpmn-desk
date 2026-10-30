import { useCallback, useEffect, useState } from 'react';
import type { Connection } from '../../shared/runtime';

export const summaryPreferenceKey = 'bpmn-desk:summary-enabled';
export function summaryPreference(stored: string | null, legacy?: boolean): boolean {
  return stored === 'true' ? true : stored === 'false' ? false : legacy !== false;
}
/** Одна настройка приложения. Сначала читаем профили, затем однократно мигрируем старое значение. */
export function useSummaryPreference(connections: Connection[], preferred: string, ready: boolean) {
  const [enabled, setValue] = useState<boolean | undefined>(() => {
    const value = localStorage.getItem(summaryPreferenceKey);
    return value === 'true' || value === 'false' ? value === 'true' : undefined;
  });
  const setEnabled = useCallback((value: boolean) => { localStorage.setItem(summaryPreferenceKey, String(value)); setValue(value); }, []);
  useEffect(() => {
    if (enabled !== undefined || !ready) return;
    const profile = connections.find(item => item.id === preferred) ?? connections[0];
    setEnabled(summaryPreference(localStorage.getItem(summaryPreferenceKey), profile?.autoSummary));
  }, [connections, preferred, ready, enabled, setEnabled]);
  return { enabled: enabled ?? false, setEnabled };
}
