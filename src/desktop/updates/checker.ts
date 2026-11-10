import type { UpdateStatus } from '../../shared/updates';

export const releasesApi = 'https://api.github.com/repos/michaelbrylevskii/bpmn-desk/releases/latest';
export const releasesPage = 'https://github.com/michaelbrylevskii/bpmn-desk/releases/latest';
export const checkInterval = 6 * 60 * 60 * 1000;
export const checkTimeout = 10_000;
const responseLimit = 256 * 1024;
type ReleaseFetch = (url: string, options: RequestInit) => Promise<Response>;

function versionParts(value: string): bigint[] | null {
  if (value.length > 128) return null;
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value);
  return match ? match.slice(1).map(part => BigInt(part)) : null;
}

function newerRelease(value: unknown, current: string): string | null {
  if (!value || typeof value !== 'object' || !('tag_name' in value) || typeof value.tag_name !== 'string'
    || !('draft' in value) || value.draft !== false || !('prerelease' in value) || value.prerelease !== false) return null;
  const latest = versionParts(value.tag_name); const installed = versionParts(current);
  if (!latest || !installed) return null;
  for (let index = 0; index < 3; index++) {
    if (latest[index]! > installed[index]!) return value.tag_name.replace(/^v/, '');
    if (latest[index]! < installed[index]!) return null;
  }
  return null;
}

async function releaseBody(response: Response): Promise<unknown> {
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > responseLimit) throw new Error('Invalid release response');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let bytes = 0; let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > responseLimit) throw new Error('Release response too large');
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

/** Один фоновый запрос на приложение; сетевые ошибки не попадают в уведомления UI. */
export class UpdateChecker {
  private availableVersion: string | null = null;
  private readonly listeners = new Set<(status: UpdateStatus) => void>();
  private interval: ReturnType<typeof setInterval> | undefined;
  private request: AbortController | undefined;
  private running = false;

  constructor(private readonly currentVersion: string, private readonly fetchRelease: ReleaseFetch) {}

  status(): UpdateStatus { return { availableVersion: this.availableVersion }; }

  subscribe(listener: (status: UpdateStatus) => void): () => void {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.interval = setInterval(() => { void this.check(); }, checkInterval); this.interval.unref();
    void this.check();
  }

  stop(): void {
    this.running = false; clearInterval(this.interval); this.interval = undefined;
    this.request?.abort();
  }

  private async check(): Promise<void> {
    if (this.request) return;
    const controller = new AbortController(); this.request = controller;
    const timer = setTimeout(() => controller.abort(), checkTimeout); timer.unref();
    let availableVersion: string | null = null;
    try {
      const response = await this.fetchRelease(releasesApi, {
        signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': `BPMN-Desk/${this.currentVersion}` },
      });
      availableVersion = newerRelease(await releaseBody(response), this.currentVersion);
      if (controller.signal.aborted) availableVersion = null;
    } catch { /* Офлайн, таймаут и ограничения GitHub оставляют обычный серый бейдж. */ }
    finally { clearTimeout(timer); controller.abort(); this.request = undefined; }
    if (!this.running || availableVersion === this.availableVersion) return;
    this.availableVersion = availableVersion;
    for (const listener of this.listeners) listener(this.status());
  }
}
