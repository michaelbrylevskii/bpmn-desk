import type { ConnectionInput, PageQuery } from '../../shared/runtime';
const controls = (value: string) => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректный ответ или запрос API.');
  return value as Record<string, unknown>;
}
export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !value || value === '.' || value === '..' || value.length > 500 || controls(value)) throw new Error('Недопустимый идентификатор API.');
  return value;
}
function text(value: unknown, max = 500): string {
  if (typeof value !== 'string' || value.length > max || controls(value)) throw new Error('Недопустимое поле подключения.');
  return value.trim();
}
export function connectionInput(value: unknown): ConnectionInput {
  const data = object(value);
  const name = text(data.name); const username = text(data.username);
  const url = new URL(text(data.baseUrl, 2000));
  if (!name || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Укажи название и HTTP(S) адрес REST API без пароля, параметров и фрагмента.');
  if (data.engine !== 'flowable') throw new Error('Подключение к этому движку пока не поддерживается.');
  if (!['none', 'basic', 'bearer'].includes(String(data.authentication)) || typeof data.rememberSecret !== 'boolean') throw new Error('Недопустимая авторизация подключения.');
  if (data.authentication === 'basic' && (!username || username.includes(':'))) throw new Error('Укажи имя пользователя Basic Auth без двоеточия.');
  if (data.secret !== undefined && (typeof data.secret !== 'string' || data.secret.length > 8000 || controls(data.secret))) throw new Error('Недопустимый пароль или токен.');
  return { id: data.id === undefined ? undefined : identifier(data.id), name, baseUrl: url.href.replace(/\/+$/, '') + '/',
    engine: 'flowable', authentication: data.authentication as ConnectionInput['authentication'], username,
    secret: data.secret as string | undefined, rememberSecret: data.rememberSecret };
}
export function pageQuery(value: unknown): PageQuery {
  const data = object(value);
  if (data.start !== undefined && (typeof data.start !== 'number' || !Number.isSafeInteger(data.start) || data.start < 0 || data.start > 10000000)) throw new Error('Недопустимая страница API.');
  return { start: data.start as number | undefined, search: data.search === undefined ? undefined : text(data.search),
    definitionId: data.definitionId ? identifier(data.definitionId) : undefined, tenantId: data.tenantId === undefined ? undefined : text(data.tenantId) };
}
