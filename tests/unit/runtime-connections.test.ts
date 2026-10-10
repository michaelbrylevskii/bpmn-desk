import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConnectionStore, type SecretStorage } from '../../src/desktop/runtime/connection-store';
import { connectionInput, pageQuery } from '../../src/desktop/runtime/validation';
const input = { name: 'Local engine', engine: 'flowable' as const, baseUrl: 'http://127.0.0.1:8080/process-api', authentication: 'basic' as const, username: 'reader', secret: 'test-only-secret', rememberSecret: false };
const secrets: SecretStorage = { available: () => true, encrypt: value => Buffer.from(value).toString('base64'), decrypt: value => Buffer.from(value, 'base64').toString() };

describe('подключения', () => {
  it('секрет сессии не попадает в профиль и не переживает перезапуск', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'desk-connections-'));
    try {
      const store = new ConnectionStore(dir, secrets); await store.load(); const saved = await store.save(input);
      expect(saved.hasSecret).toBe(true); expect(saved).not.toHaveProperty('secret');
      const disk = await readFile(join(dir, 'connections.json'), 'utf8'); expect(disk).not.toContain(input.secret);
      const reopened = new ConnectionStore(dir, secrets); await reopened.load();
      expect(reopened.list().items[0]?.hasSecret).toBe(false); expect(() => reopened.credentials(saved.id)).toThrow('Введи');
      expect(store.credentials(saved.id).secret).toBe(input.secret);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('запомненный секрет расшифровывается только в main; смена адреса не переносит его', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'desk-connections-'));
    try {
      const store = new ConnectionStore(dir, secrets); const saved = await store.save({ ...input, rememberSecret: true });
      const reopened = new ConnectionStore(dir, secrets); await reopened.load(); expect(reopened.credentials(saved.id).secret).toBe(input.secret);
      await reopened.save({ ...input, id: saved.id, baseUrl: 'http://localhost:9000/api', secret: undefined, rememberSecret: false });
      expect(() => reopened.credentials(saved.id)).toThrow('Введи');
      await reopened.delete(saved.id); expect(reopened.list().items).toHaveLength(0);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('не допускает сохранение секретов без хранилища ОС', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'desk-connections-'));
    try {
      const store = new ConnectionStore(dir, { ...secrets, available: () => false });
      await expect(store.save({ ...input, rememberSecret: true })).rejects.toThrow('Хранилище');
      expect(store.list().items).toHaveLength(0);
      expect((await store.save(input)).hasSecret).toBe(true);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('не принимает встроенные пароли, неподдерживаемые движки и неверные страницы', () => {
    expect(() => connectionInput({ ...input, baseUrl: 'https://reader:password@host/api' })).toThrow();
    expect(() => connectionInput({ ...input, engine: 'camunda7' })).toThrow();
    expect(() => connectionInput({ ...input, baseUrl: 'file:///tmp' })).toThrow();
    expect(() => pageQuery({ start: -1 })).toThrow();
    expect(() => pageQuery({ size: 10000 })).toThrow();
    expect(() => pageQuery({ order: 'anything' })).toThrow();
  });
  it('проверка черновика не сохраняет профиль и использует секрет только при совпадении адреса и авторизации', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'desk-preview-'));
    try {
      const store = new ConnectionStore(dir, secrets);
      expect(store.preview(input).secret).toBe(input.secret); expect(store.list().items).toHaveLength(0);
      const saved = await store.save(input); const disk = await readFile(join(dir, 'connections.json'), 'utf8');
      expect(store.preview({ ...input, id: saved.id, secret: undefined }).secret).toBe(input.secret);
      expect(() => store.preview({ ...input, id: saved.id, secret: undefined, baseUrl: 'http://different.test/api/' })).toThrow();
      expect(await readFile(join(dir, 'connections.json'), 'utf8')).toBe(disk);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
