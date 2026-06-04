export type SendType = 'event' | 'identify';

export interface EventPayload {
  website: string;
  hostname?: string;
  screen?: string;
  language?: string;
  title?: string;
  url?: string;
  referrer?: string;
  tag?: string;
  id?: string;
  name?: string;
  data?: Record<string, unknown>;
}

export type BeforeSend = (
  type: SendType,
  payload: EventPayload,
) => EventPayload | null | undefined | false;

export interface UmamiConfig {
  websiteId: string;
  hostUrl?: string;
  autoTrack?: boolean;
  tag?: string;
  respectDNT?: boolean;
  excludeSearch?: boolean;
  excludeHash?: boolean;
  domains?: string[];
  fetchCredentials?: RequestCredentials;
  beforeSend?: BeforeSend;
  dataAttributes?: boolean;
}

export interface Environment {
  hostname: string;
  screen: string;
  language: string;
  title: string;
  url: string;
  referrer: string;
}

export interface UmamiInstance {
  track(): Promise<void>;
  track(eventName: string, data?: Record<string, unknown>): Promise<void>;
  track(payload: Partial<EventPayload>): Promise<void>;
  track(fn: (defaults: EventPayload) => Partial<EventPayload>): Promise<void>;
  identify(uniqueId: string, data?: Record<string, unknown>): Promise<void>;
  identify(data: Record<string, unknown>): Promise<void>;
  enable(): void;
  disable(): void;
  destroy(): void;
  readonly disabled: boolean;
}
