import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicWrite } from './file-store';

export class RecentFiles {
  private paths: string[] = [];
  private readonly file: string;
  private pending: Promise<void> = Promise.resolve();

  constructor(directory: string) { this.file = join(directory, 'recent-files.json'); }

  async load(): Promise<void> {
    try {
      const value: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (Array.isArray(value)) this.paths = value.filter((p): p is string => typeof p === 'string').slice(0, 12);
    } catch { this.paths = []; }
  }

  list(): string[] { return [...this.paths]; }

  async add(path: string): Promise<void> {
    this.paths = [path, ...this.paths.filter(p => p !== path)].slice(0, 12);
    const content = JSON.stringify(this.paths);
    this.pending = this.pending.catch(() => undefined).then(() => atomicWrite(this.file, content));
    await this.pending;
  }
}
