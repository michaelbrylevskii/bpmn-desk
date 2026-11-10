export interface UpdateStatus { availableVersion: string | null; checking: boolean }

export interface UpdatesBridge {
  status(): Promise<UpdateStatus>;
  check(): Promise<void>;
  onChanged(callback: (status: UpdateStatus) => void): () => void;
  openRelease(): Promise<void>;
}

export const updateChannels = {
  status: 'updates:status', check: 'updates:check', changed: 'updates:changed', openRelease: 'updates:open-release',
} as const;
