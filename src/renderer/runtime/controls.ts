import { useCallback, useState } from 'react';
import type { MonitorDestination } from './navigation-model';
import type { DiagramExport } from '../../shared/contracts';
export interface MonitorControls {
  navigation: { back?: MonitorDestination; forward?: MonitorDestination; move(direction: 'back' | 'forward'): void };
  title: string; auto: boolean; busy: boolean; canRefresh: boolean; canCopy: boolean; canExport: boolean;
  setAuto(value: boolean): void; refresh(): void; copy(): void; fit(): void; exportDiagram(format: DiagramExport): Promise<void>;
}
export function useMonitorControls() {
  const [controls, setControls] = useState<Record<string, MonitorControls>>({});
  const publish = useCallback((id: string, value: MonitorControls | undefined) => setControls(previous => {
    const next = { ...previous }; if (value) next[id] = value; else delete next[id]; return next;
  }), []);
  return { controls, publish };
}
