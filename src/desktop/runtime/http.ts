import type { Connection } from '../../shared/runtime';
import { requestTimeoutSeconds } from '../../shared/runtime';

/** Только GET к заранее выбранному REST root. Редиректы и URL из ответов не используются. */
export class RuntimeHttp {
  constructor(private readonly connection: Connection, private readonly secret: string) {}
  deadline(): AbortSignal { return AbortSignal.timeout((this.connection.requestTimeoutSeconds ?? requestTimeoutSeconds.default) * 1000); }
  async get(path: string, query: Record<string, string | number | undefined> = {}, json = true, deadline?: AbortSignal): Promise<unknown> {
    const url = new URL(path, this.connection.baseUrl);
    const base = new URL(this.connection.baseUrl);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error('Недопустимый путь API.');
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    const headers: Record<string, string> = { Accept: json ? 'application/json' : 'application/xml, text/plain' };
    if (this.connection.authentication === 'basic') headers.Authorization = `Basic ${Buffer.from(`${this.connection.username}:${this.secret}`).toString('base64')}`;
    if (this.connection.authentication === 'bearer') headers.Authorization = `Bearer ${this.secret}`;
    const timeout = this.deadline();
    const signal = deadline ? AbortSignal.any([deadline, timeout]) : timeout;
    let response: Response;
    try { response = await fetch(url, { method: 'GET', headers, redirect: 'error', signal }); }
    catch { throw new Error(signal.aborted ? 'Превышено время ожидания API.' : 'Не удалось подключиться к API: проверь адрес, сеть, TLS и отсутствие редиректа.'); }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`API вернул HTTP ${response.status}: ${path}.`); }
    if (json && !response.headers.get('content-type')?.includes('application/json')) { await response.body?.cancel(); throw new Error('API вернул не JSON. Проверь адрес REST API и авторизацию.'); }
    if (!response.body) throw new Error('API вернул пустой ответ.');
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength;
        if (size > 16 * 1024 * 1024) throw new Error('Ответ API превышает 16 МБ.'); chunks.push(item.value); }
    } catch (error) { await reader.cancel().catch(() => undefined); if (signal.aborted) throw new Error('Превышено время ожидания API.'); throw error; }
    finally { reader.releaseLock(); }
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    if (!json) return text;
    try { return JSON.parse(text) as unknown; } catch { throw new Error('API вернул некорректный JSON.'); }
  }
}
