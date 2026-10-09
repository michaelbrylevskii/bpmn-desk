import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import process from 'node:process';
const require = createRequire(import.meta.url);
const result = spawnSync(process.execPath, [require.resolve('@playwright/test/cli'), ...process.argv.slice(2)], {
  stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: '0' },
});
process.exit(result.status ?? 1);
