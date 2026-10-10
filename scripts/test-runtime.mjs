import spawn from 'cross-spawn';
import { spawn as spawnNative } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { resolve, delimiter } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve('tools/runtime-fixture');
const build = spawn.sync(process.platform === 'win32' ? 'mvn.cmd' : 'mvn', ['-q', '-f', `${root}/pom.xml`, 'compile', 'dependency:build-classpath', '-Dmdep.outputFile=target/classpath.txt'], { stdio: 'inherit' });
if (build.error) throw new Error('Для runtime-проверок нужны Maven и JDK 17+.', { cause: build.error });
if (build.status !== 0) process.exit(build.status ?? 1);
await mkdir(resolve('.cache'), { recursive: true });
const directory = await mkdtemp(resolve('.cache/runtime-fixture-'));
const output = resolve(directory, 'ready.json');
const log = createWriteStream(resolve(directory, 'server.log'));
const classpath = `${root}/target/classes${delimiter}${(await readFile(`${root}/target/classpath.txt`, 'utf8')).trim()}`;
const server = spawnNative('java', ['-cp', classpath, 'org.bpmndesk.runtimefixture.FixtureApplication'], { env: { ...process.env, BPMN_DESK_FIXTURE_OUTPUT: output }, stdio: ['ignore', 'pipe', 'pipe'] });
server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
const closed = new Promise(resolve => server.once('close', resolve));
let failure;
server.on('error', error => { failure = error; });
const shutdown = () => { server.kill(); };
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
let status = 1;
try {
  const deadline = Date.now() + 90000;
  while (true) {
    if (failure || server.exitCode !== null) throw new Error(`Тестовый Flowable завершился; см. ${directory}/server.log`, { cause: failure });
    try { JSON.parse(await readFile(output, 'utf8')); break; } catch { /* Ждём реальную готовность engine и dead-letter. */ }
    if (Date.now() > deadline) throw new Error(`Flowable не готов за 90 секунд; см. ${directory}/server.log`);
    await delay(100);
  }
  process.stdout.write('Независимый Flowable 7.2 готов: H2, версии, параллельные executions и dead-letter job.\n');
  const tests = spawnNative(process.execPath, ['scripts/playwright.mjs', 'test', '--project=runtime', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, BPMN_DESK_RUNTIME_FIXTURE: output } });
  status = await new Promise((resolve, reject) => { tests.once('error', reject); tests.once('exit', code => resolve(code ?? 1)); });
} finally {
  shutdown(); await closed; log.end(); process.removeListener('SIGINT', shutdown); process.removeListener('SIGTERM', shutdown);
  if (status === 0) await rm(directory, { recursive: true, force: true });
}
process.exit(status);
