import spawn from 'cross-spawn';
import { readFileSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import process from 'node:process';

export function javaValidator(name, className) {
  const root = resolve(`tools/${name}-validation`);
  const maven = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';
  const build = spawn.sync(maven, ['-q', '-f', `${root}/pom.xml`, 'compile', 'dependency:build-classpath', '-Dmdep.outputFile=target/classpath.txt'], { stdio: 'inherit' });
  if (build.error) throw new Error('Не удалось запустить Maven. Установи Maven и JDK 17+ и проверь PATH.', { cause: build.error });
  if (build.status !== 0) process.exit(build.status ?? 1);
  const classpath = `${root}/target/classes${delimiter}${readFileSync(`${root}/target/classpath.txt`, 'utf8').trim()}`;
  const invoke = (args, stdio) => spawn.sync('java', ['-cp', classpath, className, ...args], { stdio });
  const validate = (...args) => {
    const result = invoke(args, 'inherit');
    if (result.error) throw new Error('Не удалось запустить Java. Установи JDK 17+ и проверь PATH.', { cause: result.error });
    if (result.status !== 0) process.exit(result.status ?? 1);
  };
  validate.reject = (expected, ...args) => {
    const result = invoke(args, 'pipe');
    if (result.error) throw result.error;
    if (result.status === 0 || result.status === null || !result.stderr?.toString().includes(expected)) throw new Error('Контрольная ошибочная схема не была отклонена ожидаемой проверкой.');
    process.stdout.write('Отрицательная контрольная схема: отклонена ожидаемой проверкой.\n');
  };
  return validate;
}
