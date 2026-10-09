export interface SchemaPack {
  directory: string;
  schemasDirectory: string;
  entries: Array<{ file: string; path: string; sha256: string }>;
}
export function loadSchemaPack(directory: string | undefined): SchemaPack;
export function extraSchemaPack(): SchemaPack;
export function assertSeparateOutputs(pack: SchemaPack, directories: string[]): void;
