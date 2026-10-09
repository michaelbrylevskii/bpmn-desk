import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';

if (process.platform !== 'linux') throw new Error('Docker-сборка Windows предусмотрена для Linux. На Windows используй package:windows.');
// electronuserland/builder:24-wine; digest фиксирует Node и Wine сборочной среды.
const image = 'electronuserland/builder@sha256:41ae540902461b6cbc988987db79547fcc10cda04d2a6c6367504f59d4b37c64';
await mkdir('.cache/wine-windows', { recursive: true });
const result = spawnSync('docker', [
  'run', '--rm', '--init', '--platform', 'linux/amd64',
  '--user', `${process.getuid()}:${process.getgid()}`,
  '--mount', `type=bind,source=${resolve('.')},target=/project`,
  '--workdir', '/project',
  '--env', 'WINEPREFIX=/project/.cache/wine-windows',
  '--entrypoint', 'node', image,
  'scripts/package.mjs', '--win', '--x64',
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
