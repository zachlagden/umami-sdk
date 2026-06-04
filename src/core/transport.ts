import type { EventPayload, SendType } from './types';

export interface TransportState {
  cacheToken?: string;
  disabled: boolean;
}

export interface SendOptions {
  endpoint: string;
  type: SendType;
  payload: EventPayload;
  credentials: RequestCredentials;
  state: TransportState;
  fetchFn?: typeof fetch;
  headers?: Record<string, string>;
}

interface SendResponse {
  cache?: string;
  disabled?: boolean;
}

export async function send(opts: SendOptions): Promise<void> {
  const { endpoint, type, payload, credentials, state } = opts;
  const fetchFn = opts.fetchFn ?? fetch;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(state.cacheToken !== undefined ? { 'x-umami-cache': state.cacheToken } : {}),
    ...opts.headers,
  };

  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      body: JSON.stringify({ type, payload }),
      headers,
      keepalive: true,
      credentials,
    });
    const data = (await res.json().catch(() => undefined)) as SendResponse | undefined;
    if (data) {
      if (typeof data.cache === 'string') state.cacheToken = data.cache;
      state.disabled = !!data.disabled;
    }
  } catch {
    // Analytics must never throw into the host app.
  }
}
