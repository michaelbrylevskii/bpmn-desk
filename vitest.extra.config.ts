import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/extra/roundtrip.test.ts'], environment: 'node' } });
