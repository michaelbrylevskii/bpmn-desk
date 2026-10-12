import { expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import type { Connection } from '../../src/shared/runtime';
import { RuntimeHttp } from '../../src/desktop/runtime/http';

it('настройка подключения охватывает чтение body, а общий deadline ограничивает более долгий таймаут', async () => {
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json'); response.write('{');
    const timer = setTimeout(() => response.end('"data":[]}'), 150);
    response.on('close', () => clearTimeout(timer));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Нет порта');
  const profile: Connection = { id: 'c', name: 'test', engine: 'flowable', baseUrl: `http://127.0.0.1:${address.port}/`, authentication: 'none', username: '', hasSecret: false, secretStored: false };
  const realTimeout = AbortSignal.timeout.bind(AbortSignal);
  // Масштабируем только часы HTTP-бюджета; сервер и отмена чтения остаются настоящими.
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => realTimeout(ms === 15000 ? 50 : ms === 30000 ? 1000 : ms));
  try {
    await expect(new RuntimeHttp(profile, '').get('list')).rejects.toThrow('Превышено время ожидания API.');
    const http = new RuntimeHttp({ ...profile, requestTimeoutSeconds: 30 }, '');
    await expect(http.get('list')).resolves.toEqual({ data: [] });
    await expect(http.get('list', {}, true, realTimeout(50))).rejects.toThrow('Превышено время ожидания API.');
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([15000, 30000, 30000]);
  } finally {
    timeout.mockRestore(); server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
