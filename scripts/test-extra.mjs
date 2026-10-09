import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { assertSeparateOutputs, extraSchemaPack } from './lib/schema-pack.mjs';
import { recordExtraResults } from './lib/extra-results.mjs';

const require = createRequire(import.meta.url);
const pack = extraSchemaPack();
assertSeparateOutputs(pack, ['.cache/extra-schema-exports', '.cache/extra-test-results']);
rmSync('.cache/extra-schema-exports', { recursive: true, force: true });
const env = { ...process.env, BPMN_DESK_EXTRA_SCHEMAS: pack.directory, PLAYWRIGHT_BROWSERS_PATH: '0' };
for (const args of [
  [resolve(dirname(require.resolve('vitest/package.json')), 'vitest.mjs'), 'run', '--config', 'vitest.extra.config.ts'],
  [require.resolve('@playwright/test/cli'), 'test', '--config', 'playwright.extra.config.ts'],
]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
recordExtraResults(pack);
