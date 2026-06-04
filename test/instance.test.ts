import { describe, it, expect, vi } from 'vitest';
import { createUmami } from '../src/core/instance';
import type { Environment } from '../src/core/types';

const env: Environment = {
  hostname: 'example.com', screen: '1x1', language: 'en',
  title: 'T', url: 'https://example.com/p', referrer: '',
};

function setup(overrides: Partial<Parameters<typeof createUmami>[0]> = {}) {
  const fetchFn = vi.fn(async () => ({ json: async () => ({}) })) as unknown as typeof fetch;
  const instance = createUmami(
    { websiteId: 'abc', hostUrl: 'https://a.test', autoTrack: false, ...overrides },
    { getEnvironment: () => env, fetchFn, isOnline: () => true },
  );
  const body = () => JSON.parse((fetchFn as any).mock.calls.at(-1)[1].body);
  return { instance, fetchFn, body };
}

describe('createUmami', () => {
  it('builds /api/send from hostUrl', async () => {
    const { instance, fetchFn } = setup();
    await instance.track();
    expect((fetchFn as any).mock.calls[0][0]).toBe('https://a.test/api/send');
  });

  it('track() with no args sends a pageview (no name)', async () => {
    const { instance, body } = setup();
    await instance.track();
    expect(body()).toEqual({ type: 'event', payload: expect.objectContaining({ website: 'abc', url: 'https://example.com/p' }) });
    expect(body().payload.name).toBeUndefined();
  });

  it('track(name, data) sends a named event', async () => {
    const { instance, body } = setup();
    await instance.track('signup', { plan: 'pro' });
    expect(body().payload.name).toBe('signup');
    expect(body().payload.data).toEqual({ plan: 'pro' });
  });

  it('track(object) merges onto defaults', async () => {
    const { instance, body } = setup();
    await instance.track({ name: 'x', url: '/override' });
    expect(body().payload.website).toBe('abc');
    expect(body().payload.name).toBe('x');
    expect(body().payload.url).toBe('/override');
  });

  it('track(fn) merges the returned partial onto defaults', async () => {
    const { instance, body } = setup();
    await instance.track((d) => ({ referrer: `prev-of-${d.url}` }));
    expect(body().payload.referrer).toBe('prev-of-https://example.com/p');
    expect(body().payload.website).toBe('abc');
  });

  it('identify(id) persists id onto subsequent events', async () => {
    const { instance, body } = setup();
    await instance.identify('user-1');
    expect(body().type).toBe('identify');
    expect(body().payload.id).toBe('user-1');
    await instance.track('e');
    expect(body().payload.id).toBe('user-1');
  });

  it('identify(id, data) and identify(data)', async () => {
    const { instance, body } = setup();
    await instance.identify('user-2', { tier: 'gold' });
    expect(body().payload.id).toBe('user-2');
    expect(body().payload.data).toEqual({ tier: 'gold' });
    await instance.identify({ tier: 'silver' });
    expect(body().payload.data).toEqual({ tier: 'silver' });
    expect(body().payload.id).toBe('user-2');
  });

  it('beforeSend can mutate the payload', async () => {
    const { instance, body } = setup({ beforeSend: (_t, p) => ({ ...p, data: { redacted: true } }) });
    await instance.track('e', { secret: 1 });
    expect(body().payload.data).toEqual({ redacted: true });
  });

  it('beforeSend returning falsy drops the event', async () => {
    const { instance, fetchFn } = setup({ beforeSend: () => null });
    await instance.track('e');
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('buffers while offline and flushes on online', async () => {
    let online = false;
    const fetchFn = vi.fn(async () => ({ json: async () => ({}) })) as unknown as typeof fetch;
    const instance = createUmami(
      { websiteId: 'abc', hostUrl: 'https://a.test', autoTrack: false },
      { getEnvironment: () => env, fetchFn, isOnline: () => online },
    );
    await instance.track('queued');
    expect(fetchFn).not.toHaveBeenCalled();
    online = true;
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
