import { afterEach, expect, it, vi } from 'vitest';
import { readRecovery, writeRecovery } from '../../src/renderer/documents/recovery';
import type { DocumentRecord } from '../../src/renderer/documents/types';

function storage() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  vi.stubGlobal('localStorage', localStorage);
  return localStorage;
}
afterEach(() => vi.unstubAllGlobals());

it('восстанавливает каждый записанный документ, включая документы после двадцатого', () => {
  storage();
  const records: DocumentRecord[] = Array.from({ length: 25 }, (_, index) => ({
    id: `doc-${index}`, name: `diagram-${index}.bpmn`, path: '', sourceXml: '<original />', savedXml: '<original />',
    xml: `<changed id="${index}" />`, draft: index === 24 ? '<unfinished draft' : undefined,
  }));
  const pending = [{ name: 'previous.bpmn', xml: '<previous />', savedXml: '<saved />' }];
  writeRecovery(records, pending);
  const restored = readRecovery();
  expect(restored).toHaveLength(26);
  expect(restored[0]).toEqual(pending[0]);
  expect(restored.at(-1)).toMatchObject({ name: 'diagram-24.bpmn', xml: '<changed id="24" />', draft: '<unfinished draft' });
});

it('исключает повреждённые записи без потери остальных документов', () => {
  const localStorage = storage();
  const valid = { name: 'valid.bpmn', xml: '<valid />', savedXml: '<saved />' };
  localStorage.setItem('bpmn-desk:recovery:v1', JSON.stringify([null, valid, { ...valid, draft: 42 }, { name: 7 }]));
  expect(readRecovery()).toEqual([valid]);
  localStorage.setItem('bpmn-desk:recovery:v1', '<broken-json>');
  expect(readRecovery()).toEqual([]);
});
