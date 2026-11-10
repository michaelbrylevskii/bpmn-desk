import { app, net, shell } from 'electron';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

// Тестовый entrypoint запускает настоящее приложение и подменяет только границу сети/ОС.
// Ни запросов к GitHub, ни запуска пользовательского браузера из теста.
Object.defineProperty(app, 'isPackaged', { value: true });
Object.defineProperty(process, 'resourcesPath', { value: fileURLToPath(new URL('../../', import.meta.url)) });
const state = { requests: 0, opened: [], complete: undefined };
Reflect.set(globalThis, 'releaseFixture', state);
const originalFetch = net.fetch.bind(net);
net.fetch = (url, options) => {
  if (url !== 'https://api.github.com/repos/michaelbrylevskii/bpmn-desk/releases/latest') return originalFetch(url, options);
  state.requests++;
  return new Promise(resolve => {
    state.complete = () => resolve(globalThis.Response.json({ tag_name: 'v99.0.0', draft: false, prerelease: false, html_url: 'https://invalid.example/' }));
  });
};
shell.openExternal = async url => { state.opened.push(url); };
await import('../../out/main/index.js');
