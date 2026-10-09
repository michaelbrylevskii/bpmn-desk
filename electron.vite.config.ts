import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { build: { rollupOptions: { input: 'src/desktop/main.ts', output: { entryFileNames: 'index.js' } } } },
  preload: { build: { rollupOptions: { input: 'src/desktop/preload.ts', output: { format: 'cjs', entryFileNames: 'index.cjs' } } } },
  renderer: {
    root: '.', plugins: [react()],
    server: {
      watch: { ignored: ['**/.cache/**', '**/.local-schemas/**', '**/release/**', '**/test-results/**'] },
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.cache/**', '**/.local-schemas/**'] },
    },
    build: { rollupOptions: { input: 'index.html' } },
  },
});
