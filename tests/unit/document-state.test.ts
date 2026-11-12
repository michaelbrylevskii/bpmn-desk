import { expect, it } from 'vitest';
import { hasLocalEdits, isDirty, type DocumentRecord } from '../../src/renderer/documents/types';
import { sessionOverview } from '../../src/shared/session-validation';
import { documentTabStatus } from '../../src/renderer/documents/tab-status';
import { validDocument } from '../../src/shared/session-validation';

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

it('черновик дубликата входит в его исходное состояние и переживает сериализацию сессии', () => {
  const copy = record({ draft: '<unfinished', baselineDraft: '<unfinished' });
  const restored: unknown = JSON.parse(JSON.stringify(copy));
  expect(validDocument(restored)).toBe(true);
  if (!validDocument(restored)) throw new Error('Invalid test session');
  const document = { ...restored, sourceXml: restored.xml };
  expect(hasLocalEdits(document)).toBe(false);
  expect(isDirty(document)).toBe(true);
  expect(hasLocalEdits({ ...document, draft: '<different' })).toBe(true);
  expect(hasLocalEdits({ ...document, draft: undefined })).toBe(true);
  expect(hasLocalEdits({ ...document, draft: '<unfinished' })).toBe(false);
  expect(hasLocalEdits({ ...document, xml: changed, draft: undefined })).toBe(true);
  expect(validDocument({ ...copy, baselineDraft: 42 })).toBe(false);
});

it('различает локальные правки, внешние изменения и необходимость подтверждать закрытие', () => {
  const cases = [
    { fields: {}, dot: 'unbound', protect: true },
    { fields: { xml: changed }, dot: 'local', protect: true },
    { fields: { path: '/process.bpmn' }, dot: '', protect: false },
    ...(['changed', 'missing', 'unavailable'] as const).flatMap(fileState => [
      { fields: { path: '/process.bpmn', fileState }, dot: 'external', protect: false },
      { fields: { path: '/process.bpmn', fileState, xml: changed }, dot: 'conflict', protect: true },
      { fields: { path: '/process.bpmn', fileState, draft: '<unfinished' }, dot: 'conflict', protect: true },
    ]),
  ];
  for (const { fields, dot, protect } of cases) {
    const document = record(fields);
    expect(documentTabStatus(document).dot).toBe(dot);
    expect(isDirty(document)).toBe(protect);
  }
  const unavailable = documentTabStatus(record({ path: '/process.bpmn', fileState: 'unavailable' }));
  expect(unavailable.messages).toContain('Не удалось проверить файл на диске.');
  expect(unavailable.messages).not.toContain('Файл изменён на диске.');
});

it('сессия отмечает документ без файла несохранённым даже без правок', () => {
  const overview = (document: DocumentRecord) => sessionOverview({ id: 'session', updatedAt: new Date().toISOString(), dismissed: false, tabs: [{ kind: 'document', id: 'd' }], activeId: 'd', documents: [{ ...document, diskXml: original }] });
  expect(overview(record()).tabs[0]?.dirty).toBe(true);
  expect(overview(record({ path: '/tmp/saved.bpmn' })).tabs[0]?.dirty).toBe(false);
});
