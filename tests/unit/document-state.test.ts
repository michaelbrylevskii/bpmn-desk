import { expect, it } from 'vitest';
import { hasLocalEdits, isDirty, type DocumentRecord } from '../../src/renderer/documents/types';
import { sessionOverview } from '../../src/shared/session-validation';

const original = '<process id="original"/>';
const changed = '<process id="changed"/>';
const record = (fields: Partial<DocumentRecord> = {}): DocumentRecord => ({ id: 'd', name: 'process.bpmn', path: '', sourceXml: original, diskXml: original, xml: original, savedXml: original, ...fields });

it('защищает новую схему и копию без файла, не выдавая отсутствие сохранения за правки', () => {
  for (const document of [record(), record({ savedXml: null }), record({ savedXml: '' })]) {
    expect(isDirty(document)).toBe(true); expect(hasLocalEdits(document)).toBe(false);
  }
});

it('отличает правки копии от её исходного снимка, включая восстановленную сессию и XML-черновик', () => {
  const copy = record({ savedXml: '' });
  expect(hasLocalEdits({ ...copy, xml: changed })).toBe(true);
  expect(hasLocalEdits({ ...copy, sourceXml: changed, xml: changed })).toBe(true);
  expect(hasLocalEdits({ ...copy, draft: '<unfinished' })).toBe(true);
  expect(hasLocalEdits({ ...copy, xml: original })).toBe(false);
});

it('сохранение в файл снимает защиту, дальнейшие правки и черновик снова её включают', () => {
  const saved = record({ path: '/tmp/saved.bpmn' });
  expect(isDirty(saved)).toBe(false); expect(hasLocalEdits(saved)).toBe(false);
  expect(isDirty({ ...saved, xml: changed })).toBe(true);
  expect(isDirty({ ...saved, draft: '<unfinished' })).toBe(true);
});

it('сессия отмечает документ без файла несохранённым даже без правок', () => {
  const overview = (document: DocumentRecord) => sessionOverview({ id: 'session', updatedAt: new Date().toISOString(), dismissed: false, tabs: [{ kind: 'document', id: 'd' }], activeId: 'd', documents: [{ ...document, diskXml: original }] });
  expect(overview(record()).tabs[0]?.dirty).toBe(true);
  expect(overview(record({ path: '/tmp/saved.bpmn' })).tabs[0]?.dirty).toBe(false);
});
