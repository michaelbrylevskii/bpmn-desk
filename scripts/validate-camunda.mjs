import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { javaValidator } from './lib/java-validation.mjs';

const records = JSON.parse(readFileSync('examples/provenance.json', 'utf8')).filter(record => record.engine === 'camunda7');
if (!records.length) throw new Error('Встроенные схемы Camunda 7 отсутствуют.');
const validate = javaValidator('camunda', 'CamundaCheck');
for (const record of records) validate(resolve('examples', record.file), resolve('.cache/camunda-exports', record.file), record.file === 'camunda7-showcase.bpmn20.xml' ? 'showcase' : '');
validate(resolve('.cache/camunda-edits/expected-integration.bpmn20.xml'), resolve('.cache/camunda-edits/integration.bpmn20.xml'));
validate(resolve('.cache/camunda-edits/copied.bpmn20.xml'), resolve('.cache/camunda-edits/copied.bpmn20.xml'));
const source = readFileSync('examples/camunda7-showcase.bpmn20.xml', 'utf8');
const error = source.match(/<camunda:errorEventDefinition[^>]*\/>/)?.[0];
if (!error) throw new Error('Контрольный пример Camunda errorEventDefinition отсутствует.');
mkdirSync('.cache/camunda-controls', { recursive: true });
const duplicate = resolve('.cache/camunda-controls/duplicate-id.bpmn20.xml');
writeFileSync(duplicate, source.replace('<bpmn:extensionElements>', `<bpmn:extensionElements>${error}`));
validate.reject('ArchiveFailure', duplicate, duplicate);
