import process from 'node:process';
import { readFileSync } from 'node:fs';
import { releaseNotes } from './lib/release-notes.mjs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
process.stdout.write(releaseNotes(process.cwd(), process.argv[2] ?? version));
