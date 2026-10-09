import { spawnSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';
const require = createRequire(import.meta.url);
const builderCache = resolve('.cache/electron-builder');
await mkdir(builderCache, { recursive: true });
// Загруженные CommonJS-инструменты не должны наследовать type: module проекта.
await writeFile(resolve(builderCache, 'package.json'), '{"private":true,"type":"commonjs"}\n');
const result = spawnSync(process.execPath, [require.resolve('electron-builder/out/cli/cli.js'), ...process.argv.slice(2), '--publish', 'never'], {
  stdio: 'inherit', env: { ...process.env, ELECTRON_BUILDER_CACHE: builderCache, ELECTRON_CACHE: resolve('.cache/electron') },
});
process.exit(result.status ?? 1);
