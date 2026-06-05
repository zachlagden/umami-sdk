import type { EventPayload, Environment, BeforeSend, SendType, UmamiConfig } from '../core/types';
import { buildBasePayload } from '../core/payload';
import { send, type TransportState } from '../core/transport';

export interface NodeUmamiConfig {
  websiteId: string;
  hostUrl: string;
  tag?: string;
  excludeSearch?: boolean;
  excludeHash?: boolean;
  fetchCredentials?: RequestCredentials;
  beforeSend?: BeforeSend;
  fetchFn?: typeof fetch;
}

export interface NodeTrackOptions {
  url: string;
  name?: string;
  data?: Record<string, unknown>;
  id?: string;
  hostname?: string;
  referrer?: string;
  title?: string;
  language?: string;
  screen?: string;
  tag?: string;
  userAgent?: string;
  ip?: string;
}

export interface NodeIdentifyOptions extends Omit<NodeTrackOptions, 'name'> {
  id: string;
}

export interface NodeUmamiInstance {
  track(options: NodeTrackOptions): Promise<void>;
  identify(options: NodeIdentifyOptions): Promise<void>;
}

function tryHostname(value: string): string | undefined {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

export function createUmami(config: NodeUmamiConfig): NodeUmamiInstance {
  const endpoint = `${config.hostUrl.replace(/\/$/, '')}/api/send`;
  const credentials = config.fetchCredentials ?? 'omit';
  const fetchFn = config.fetchFn;

  async function dispatch(type: SendType, options: NodeTrackOptions): Promise<void> {
    const env: Environment = {
      hostname: options.hostname ?? tryHostname(options.url) ?? tryHostname(config.hostUrl) ?? '',
      screen: options.screen ?? '',
      language: options.language ?? '',
      title: options.title ?? '',
      url: options.url,
      referrer: options.referrer ?? '',
    };
    const baseConfig: UmamiConfig = {
      websiteId: config.websiteId,
      hostUrl: config.hostUrl,
      tag: options.tag ?? config.tag,
      excludeSearch: config.excludeSearch,
      excludeHash: config.excludeHash,
    };
    const payload: EventPayload = buildBasePayload(baseConfig, env, options.id);
    if (type === 'event' && options.name !== undefined) {
      payload.name = options.name;
      payload.data = options.data;
    } else if (type === 'identify') {
      payload.data = options.data;
    }

    const finalPayload = config.beforeSend ? config.beforeSend(type, payload) : payload;
    if (!finalPayload) return;

    const headers: Record<string, string> = {};
    if (options.userAgent) headers['User-Agent'] = options.userAgent;
    if (options.ip) headers['X-Forwarded-For'] = options.ip;

    const state: TransportState = { disabled: false };
    await send({ endpoint, type, payload: finalPayload, credentials, state, fetchFn, headers });
  }

  return {
    track(options: NodeTrackOptions): Promise<void> {
      return dispatch('event', options);
    },
    identify(options: NodeIdentifyOptions): Promise<void> {
      return dispatch('identify', options);
    },
  };
}

type Inline = { websiteId: string; hostUrl: string; beforeSend?: BeforeSend; fetchFn?: typeof fetch };

export function track(options: NodeTrackOptions & Inline): Promise<void> {
  const { websiteId, hostUrl, beforeSend, fetchFn, ...rest } = options;
  return createUmami({ websiteId, hostUrl, beforeSend, fetchFn }).track(rest);
}

export function identify(options: NodeIdentifyOptions & Inline): Promise<void> {
  const { websiteId, hostUrl, beforeSend, fetchFn, ...rest } = options;
  return createUmami({ websiteId, hostUrl, beforeSend, fetchFn }).identify(rest as NodeIdentifyOptions);
}
