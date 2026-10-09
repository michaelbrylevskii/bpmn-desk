import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';
const result = spawnSync(process.execPath, ['node_modules/electron/install.js'], {
  stdio: 'inherit', env: { ...process.env, electron_config_cache: resolve('.cache/electron') },
});
process.exit(result.status ?? 1);
