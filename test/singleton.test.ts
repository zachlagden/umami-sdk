import { describe, it, expect, vi, beforeEach } from 'vitest';
import { umami, createUmami } from '../src/index';
import type { Environment } from '../src/core/types';

const env: Environment = {
  hostname: 'example.com', screen: '1x1', language: 'en',
  title: 'T', url: 'https://example.com/p', referrer: '',
};

beforeEach(() => {
  umami.reset();
});

describe('singleton', () => {
  it('re-exports createUmami', () => {
    expect(typeof createUmami).toBe('function');
  });

  it('queues calls made before init, then flushes on init', async () => {
    const fetchFn = vi.fn(async () => ({ json: async () => ({}) })) as unknown as typeof fetch;
    const pending = umami.track('early');
    expect(fetchFn).not.toHaveBeenCalled();

    umami.init(
      { websiteId: 'abc', hostUrl: 'https://a.test', autoTrack: false },
      { getEnvironment: () => env, fetchFn, isOnline: () => true },
    );
    await pending;
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((fetchFn as any).mock.calls[0][0]).toBe('https://a.test/api/send');
  });

  it('forwards calls directly after init', async () => {
    const fetchFn = vi.fn(async () => ({ json: async () => ({}) })) as unknown as typeof fetch;
    umami.init(
      { websiteId: 'abc', hostUrl: 'https://a.test', autoTrack: false },
      { getEnvironment: () => env, fetchFn, isOnline: () => true },
    );
    await umami.track('after');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
