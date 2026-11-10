export interface UpdateStatus { availableVersion: string | null }

export interface UpdatesBridge {
  status(): Promise<UpdateStatus>;
  onChanged(callback: (status: UpdateStatus) => void): () => void;
  openRelease(): Promise<void>;
}

export const updateChannels = {
  status: 'updates:status', changed: 'updates:changed', openRelease: 'updates:open-release',
} as const;
