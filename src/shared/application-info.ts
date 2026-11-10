export interface ApplicationInfo {
  version: string; electron: string; chromium: string; node: string; platform: string; arch: string;
}
export type ApplicationLink = 'repository' | 'author';
export interface ApplicationBridge {
  info(): Promise<ApplicationInfo>;
  openLink(link: ApplicationLink): Promise<void>;
}
export const applicationChannels = { info: 'application:info', openLink: 'application:open-link' } as const;
