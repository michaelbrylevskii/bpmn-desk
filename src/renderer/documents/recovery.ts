import type { DocumentRecord } from './types';
import { isDirty } from './types';

const KEY = 'bpmn-desk:recovery:v1';
export interface RecoveryRecord { name: string; xml: string; savedXml: string; draft?: string; baselineDraft?: string }

export function readRecovery(): RecoveryRecord[] {
  try {
    const records: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(records)) return [];
    return records.filter((record): record is RecoveryRecord => record && typeof record === 'object' &&
      typeof record.name === 'string' && typeof record.xml === 'string' && typeof record.savedXml === 'string' &&
      (record.draft === undefined || typeof record.draft === 'string') && (record.baselineDraft === undefined || typeof record.baselineDraft === 'string'));
  } catch { return []; }
}

export function writeRecovery(documents: DocumentRecord[], pending: RecoveryRecord[] = []): void {
  const records = [...pending, ...documents.filter(isDirty).map(({ name, xml, savedXml, draft, baselineDraft }) => ({ name, xml, savedXml: savedXml ?? xml, draft, baselineDraft }))];
  localStorage.setItem(KEY, JSON.stringify(records));
}

export function clearRecovery(): void { localStorage.removeItem(KEY); }
