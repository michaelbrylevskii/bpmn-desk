import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import { extraSchemaPack } from './lib/schema-pack.mjs';
import { verifyExtraResults } from './lib/extra-results.mjs';
import { javaValidator } from './lib/java-validation.mjs';
const extra = process.argv.includes('--extra') ? extraSchemaPack() : undefined;
if (extra) verifyExtraResults(extra);
const validate = javaValidator('flowable', 'FlowableCheck');
if (extra) {
  validate(extra.schemasDirectory, resolve('.cache/extra-schema-exports'));
} else {
  const records = JSON.parse(readFileSync('examples/provenance.json', 'utf8')).filter(record => record.engine === 'flowable');
  if (!records.length) throw new Error('Встроенные схемы Flowable отсутствуют.');
  for (const record of records) validate(resolve('examples'), resolve('.cache/flowable-exports'), record.file);
  validate(resolve('examples'), resolve('.cache/flowable-layout'), 'flowable-boundary-events.bpmn20.xml');
}
