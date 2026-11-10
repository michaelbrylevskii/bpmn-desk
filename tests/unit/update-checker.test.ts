import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UpdateChecker, checkInterval, checkTimeout, releasesApi } from '../../src/desktop/updates/checker';

const release = (tag_name = 'v0.8.0', extra: Record<string, unknown> = {}) => Response.json({ tag_name, draft: false, prerelease: false, ...extra });
let checker: UpdateChecker;
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { checker?.stop(); vi.useRealTimers(); });
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('GitHub release checks', () => {
  it('supports a manual check without polling and shares the in-flight request', async () => {
    let complete: ((response: Response) => void) | undefined;
    const transport = vi.fn<typeof fetch>().mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    checker = new UpdateChecker('0.7.1', transport); const changed = vi.fn(); checker.subscribe(changed);
    const first = checker.checkNow(); const second = checker.checkNow(); expect(second).toBe(first);
    await flush(); expect(transport).toHaveBeenCalledTimes(1); expect(checker.status().checking).toBe(true);
    expect(changed).toHaveBeenCalledWith({ availableVersion: null, checking: true });
    complete!(release()); await first;
    expect(checker.status()).toEqual({ availableVersion: '0.8.0', checking: false });
    await vi.advanceTimersByTimeAsync(checkInterval); expect(transport).toHaveBeenCalledTimes(1);
    checker.stop(); await checker.checkNow(); expect(transport).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['v0.7.2', '0.7.2'], ['v0.8.0', '0.8.0'], ['0.10.0', '0.10.0'], ['v1.0.0', '1.0.0'],
    ['v0.7.1', null], ['v0.7.0', null], ['v0.6.99', null], ['v0.8.0-beta.1', null],
    ['v00.8.0', null], ['0.8', null], ['not-a-version', null],
  ])('compares %s with the installed version numerically', async (tag, expected) => {
    checker = new UpdateChecker('0.7.1', vi.fn<typeof fetch>().mockResolvedValue(release(tag)));
    checker.start(); await flush();
    expect(checker.status()).toEqual({ availableVersion: expected, checking: false });
  });

  it.each([{ draft: true }, { prerelease: true }, { tag_name: 12 }, { draft: null }, { prerelease: undefined }])('ignores invalid or unpublished metadata: %j', async extra => {
    checker = new UpdateChecker('0.7.1', vi.fn<typeof fetch>().mockResolvedValue(release('v0.8.0', extra)));
    checker.start(); await flush(); expect(checker.status().availableVersion).toBeNull();
  });

  it('checks at startup and every six hours once for all subscribers', async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => release());
    checker = new UpdateChecker('0.7.1', transport);
    const firstWindow = vi.fn(); const unsubscribe = checker.subscribe(firstWindow);
    checker.start(); checker.start(); await flush();
    const secondWindow = vi.fn(); checker.subscribe(secondWindow);
    expect(checker.status()).toEqual({ availableVersion: '0.8.0', checking: false });
    expect(transport).toHaveBeenCalledTimes(1);
    expect(transport).toHaveBeenCalledWith(releasesApi, expect.objectContaining({ credentials: 'omit', cache: 'no-store', redirect: 'error' }));
    await vi.advanceTimersByTimeAsync(checkInterval - 1); expect(transport).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); expect(transport).toHaveBeenCalledTimes(2);
    expect(firstWindow).toHaveBeenCalledTimes(4); expect(secondWindow).toHaveBeenCalledTimes(2);
    unsubscribe(); transport.mockImplementation(async () => release('v0.9.0'));
    await vi.advanceTimersByTimeAsync(checkInterval);
    expect(firstWindow).toHaveBeenCalledTimes(4); expect(secondWindow).toHaveBeenCalledWith({ availableVersion: '0.9.0', checking: false });
  });

  it.each(['network', 'rate-limit', 'server', 'json', 'large-body', 'large-header', 'missing'] as const)('silently clears a previous update after %s failure, then recovers', async failure => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => release());
    checker = new UpdateChecker('0.7.1', transport); const changed = vi.fn(); checker.subscribe(changed);
    checker.start(); await flush(); expect(checker.status().availableVersion).toBe('0.8.0');
    transport.mockImplementation(async () => {
      if (failure === 'network') throw new Error('offline');
      if (failure === 'rate-limit') return new Response('', { status: 403 });
      if (failure === 'server') return new Response('', { status: 500 });
      if (failure === 'json') return new Response('<html>error</html>');
      if (failure === 'large-body') return new Response(' '.repeat(256 * 1024 + 1));
      if (failure === 'large-header') return new Response('{}', { headers: { 'content-length': '9999999' } });
      return new Response('', { status: 404 });
    });
    await vi.advanceTimersByTimeAsync(checkInterval);
    expect(checker.status().availableVersion).toBeNull(); expect(changed).toHaveBeenLastCalledWith({ availableVersion: null, checking: false });
    transport.mockImplementation(async () => release()); await vi.advanceTimersByTimeAsync(checkInterval);
    expect(checker.status().availableVersion).toBe('0.8.0');
  });

  it.each(['headers', 'body'] as const)('times out slow %s without blocking the next scheduled check', async stage => {
    const transport = vi.fn<typeof fetch>().mockImplementation(async () => release());
    checker = new UpdateChecker('0.7.1', transport); checker.start(); await flush();
    transport.mockImplementation(async (_url, options) => {
      const signal = options!.signal!;
      if (stage === 'headers') return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
      return new Response(new ReadableStream({ start(controller) {
        controller.enqueue(new TextEncoder().encode('{'));
        signal.addEventListener('abort', () => controller.error(new Error('aborted')), { once: true });
      } }));
    });
    await vi.advanceTimersByTimeAsync(checkInterval); expect(checker.status().availableVersion).toBe('0.8.0');
    await vi.advanceTimersByTimeAsync(checkTimeout); expect(checker.status().availableVersion).toBeNull();
    transport.mockImplementation(async () => release('v0.9.0'));
    await vi.advanceTimersByTimeAsync(checkInterval - checkTimeout); expect(checker.status().availableVersion).toBe('0.9.0');
  });

  it('aborts work on shutdown and stops the periodic timer', async () => {
    let signal: AbortSignal | undefined;
    const transport = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      signal = options!.signal!;
      return new Promise<Response>((_resolve, reject) => { signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); });
    });
    checker = new UpdateChecker('0.7.1', transport); const changed = vi.fn(); checker.subscribe(changed);
    checker.start(); await flush(); checker.stop(); await flush();
    expect(signal?.aborted).toBe(true); expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenLastCalledWith({ availableVersion: null, checking: true });
    await vi.advanceTimersByTimeAsync(checkInterval * 2); expect(transport).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
