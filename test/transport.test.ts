import { describe, it, expect, vi } from 'vitest';
import { send, type TransportState } from '../src/core/transport';
import type { EventPayload } from '../src/core/types';

const payload: EventPayload = { website: 'abc', url: 'https://e.com/' };

function mockFetch(responseBody: unknown) {
  return vi.fn(async () => ({
    json: async () => responseBody,
  })) as unknown as typeof fetch;
}

describe('send', () => {
  it('POSTs application/json with keepalive and the {type, payload} body', async () => {
    const fetchFn = mockFetch({});
    const state: TransportState = { disabled: false };
    await send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as any).mock.calls[0];
    expect(url).toBe('/api/send');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe('omit');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['x-umami-cache']).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ type: 'event', payload });
  });

  it('stores cache token and replays it as x-umami-cache', async () => {
    const fetchFn = mockFetch({ cache: 'tok-1' });
    const state: TransportState = { disabled: false };
    await send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn });
    expect(state.cacheToken).toBe('tok-1');

    await send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn });
    const init = (fetchFn as any).mock.calls[1][1];
    expect(init.headers['x-umami-cache']).toBe('tok-1');
  });

  it('sets disabled flag when server returns disabled', async () => {
    const fetchFn = mockFetch({ disabled: true });
    const state: TransportState = { disabled: false };
    await send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn });
    expect(state.disabled).toBe(true);
  });

  it('swallows fetch errors', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    const state: TransportState = { disabled: false };
    await expect(
      send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn }),
    ).resolves.toBeUndefined();
  });

  it('merges extra headers (for node UA/XFF)', async () => {
    const fetchFn = mockFetch({});
    const state: TransportState = { disabled: false };
    await send({
      endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn,
      headers: { 'User-Agent': 'node', 'X-Forwarded-For': '1.2.3.4' },
    });
    const init = (fetchFn as any).mock.calls[0][1];
    expect(init.headers['User-Agent']).toBe('node');
    expect(init.headers['X-Forwarded-For']).toBe('1.2.3.4');
  });
});
