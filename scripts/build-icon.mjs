import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const svg = await readFile('build/icon.svg', 'utf8');
const rendered = new Resvg(svg, { fitTo: { mode: 'width', value: 512 } }).render();
await writeFile('build/icon.png', rendered.asPng());
