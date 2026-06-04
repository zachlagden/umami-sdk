import type { UmamiConfig, UmamiInstance, EventPayload, Environment, SendType } from './types';
import { buildBasePayload } from './payload';
import { send, type TransportState } from './transport';
import { getBrowserEnvironment } from './environment';
import { isBlocked, isOptedOut, setOptOut } from './privacy';

export interface UmamiDeps {
  getEnvironment?: () => Environment;
  fetchFn?: typeof fetch;
  isOnline?: () => boolean;
}

function resolveEndpoint(hostUrl?: string): string {
  const base = (hostUrl ?? '').replace(/\/$/, '');
  return `${base}/api/send`;
}

function defaultIsOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function createUmami(config: UmamiConfig, deps: UmamiDeps = {}): UmamiInstance {
  const getEnvironment = deps.getEnvironment ?? getBrowserEnvironment;
  const isOnline = deps.isOnline ?? defaultIsOnline;
  const fetchFn = deps.fetchFn;
  const credentials = config.fetchCredentials ?? 'omit';
  const endpoint = resolveEndpoint(config.hostUrl);
  const state: TransportState = { disabled: false };

  let identifyId: string | undefined;
  const offlineBuffer: Array<{ type: SendType; payload: EventPayload }> = [];
  let onlineListenerAttached = false;

  function base(): EventPayload {
    return buildBasePayload(config, getEnvironment(), identifyId);
  }

  function flushOffline(): void {
    if (!isOnline()) return;
    const items = offlineBuffer.splice(0, offlineBuffer.length);
    for (const item of items) {
      void send({ endpoint, type: item.type, payload: item.payload, credentials, state, fetchFn });
    }
  }

  function attachOnlineListener(): void {
    if (onlineListenerAttached || typeof window === 'undefined') return;
    onlineListenerAttached = true;
    window.addEventListener('online', flushOffline);
  }

  async function dispatch(type: SendType, payload: EventPayload): Promise<void> {
    if (isBlocked(config, getEnvironment(), state.disabled)) return;
    const finalPayload = config.beforeSend ? config.beforeSend(type, payload) : payload;
    if (!finalPayload) return;
    if (!isOnline()) {
      offlineBuffer.push({ type, payload: finalPayload });
      attachOnlineListener();
      return;
    }
    await send({ endpoint, type, payload: finalPayload, credentials, state, fetchFn });
  }

  const instance: UmamiInstance = {
    track(arg1?: unknown, arg2?: unknown): Promise<void> {
      const defaults = base();
      let payload: EventPayload;
      if (typeof arg1 === 'string') {
        payload = { ...defaults, name: arg1, data: arg2 as Record<string, unknown> | undefined };
      } else if (typeof arg1 === 'function') {
        const partial = (arg1 as (d: EventPayload) => Partial<EventPayload>)(defaults);
        payload = { ...defaults, ...partial };
      } else if (arg1 && typeof arg1 === 'object') {
        payload = { ...defaults, ...(arg1 as Partial<EventPayload>) };
      } else {
        payload = defaults;
      }
      return dispatch('event', payload);
    },
    identify(arg1: unknown, arg2?: unknown): Promise<void> {
      if (typeof arg1 === 'string') identifyId = arg1;
      const data =
        arg1 && typeof arg1 === 'object'
          ? (arg1 as Record<string, unknown>)
          : (arg2 as Record<string, unknown> | undefined);
      state.cacheToken = '';
      return dispatch('identify', { ...base(), data });
    },
    enable(): void {
      setOptOut(false);
    },
    disable(): void {
      setOptOut(true);
    },
    get disabled(): boolean {
      return state.disabled || isOptedOut();
    },
  };

  return instance;
}
