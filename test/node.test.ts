import { describe, it, expect, vi } from 'vitest';
import { createUmami, track, identify } from '../src/node/index';

function mockFetch() {
  return vi.fn(async () => ({ json: async () => ({}) })) as unknown as typeof fetch;
}
function lastCall(fetchFn: typeof fetch) {
  const call = (fetchFn as any).mock.calls.at(-1);
  return { url: call[0] as string, init: call[1] as RequestInit & { headers: Record<string, string> } };
}
function body(fetchFn: typeof fetch) {
  return JSON.parse(lastCall(fetchFn).init.body as string);
}

describe('node createUmami', () => {
  it('POSTs to {hostUrl}/api/send with an event payload', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.track({ url: 'https://site.com/checkout' });
    expect(lastCall(fetchFn).url).toBe('https://a.test/api/send');
    expect(body(fetchFn)).toEqual({
      type: 'event',
      payload: expect.objectContaining({
        website: 'abc',
        url: 'https://site.com/checkout',
        hostname: 'site.com',
      }),
    });
    expect(body(fetchFn).payload.name).toBeUndefined();
  });

  it('sends a named event with data', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.track({ url: '/checkout', name: 'purchase', data: { amount: 49 } });
    expect(body(fetchFn).payload.name).toBe('purchase');
    expect(body(fetchFn).payload.data).toEqual({ amount: 49 });
  });

  it('forwards userAgent as User-Agent and ip as X-Forwarded-For', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.track({ url: '/p', userAgent: 'Mozilla/5.0 test', ip: '203.0.113.7' });
    const { init } = lastCall(fetchFn);
    expect(init.headers['User-Agent']).toBe('Mozilla/5.0 test');
    expect(init.headers['X-Forwarded-For']).toBe('203.0.113.7');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('derives hostname from hostUrl when url is a path, and explicit hostname wins', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://analytics.test', fetchFn });
    await umami.track({ url: '/p' });
    expect(body(fetchFn).payload.hostname).toBe('analytics.test');
    await umami.track({ url: '/p', hostname: 'shop.test' });
    expect(body(fetchFn).payload.hostname).toBe('shop.test');
  });

  it('identify sends type identify with id and data', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.identify({ id: 'user-1', url: '/p', data: { tier: 'gold' } });
    expect(body(fetchFn).type).toBe('identify');
    expect(body(fetchFn).payload.id).toBe('user-1');
    expect(body(fetchFn).payload.data).toEqual({ tier: 'gold' });
  });

  it('attaches id to a tracked event when provided', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.track({ url: '/p', name: 'click', id: 'user-9' });
    expect(body(fetchFn).payload.id).toBe('user-9');
  });

  it('beforeSend can drop the event', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn, beforeSend: () => null });
    await umami.track({ url: '/p' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('never rejects when fetch throws', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await expect(umami.track({ url: '/p' })).resolves.toBeUndefined();
  });
});

describe('node standalone helpers', () => {
  it('track() accepts inline websiteId + hostUrl', async () => {
    const fetchFn = mockFetch();
    await track({ websiteId: 'abc', hostUrl: 'https://a.test', url: '/p', name: 'e', fetchFn });
    expect(lastCall(fetchFn).url).toBe('https://a.test/api/send');
    expect(body(fetchFn).payload.name).toBe('e');
  });

  it('identify() accepts inline websiteId + hostUrl', async () => {
    const fetchFn = mockFetch();
    await identify({ websiteId: 'abc', hostUrl: 'https://a.test', id: 'u1', url: '/p', data: { a: 1 }, fetchFn });
    expect(body(fetchFn).type).toBe('identify');
    expect(body(fetchFn).payload.id).toBe('u1');
  });
});
