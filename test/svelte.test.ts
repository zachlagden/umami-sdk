// @vitest-environment-options { "url": "https://example.com/" }
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { createUmamiStore, umami } from '../src/svelte/index';

const fetchMock = vi.fn(async (..._args: unknown[]) => ({ json: async () => ({}) }));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
  window.history.replaceState(null, '', 'https://example.com/');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('svelte adapter', () => {
  it('exposes the instance through a readable store; track works', async () => {
    const store = createUmamiStore({ websiteId: 'abc', hostUrl: 'https://a.test', autoTrack: false });
    const instance = get(store);
    await instance.track('e', { a: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(sentBody.payload.name).toBe('e');
    store.destroy();
  });

  it('destroy() tears the instance down (no pageview after destroy navigation)', () => {
    const store = createUmamiStore({ websiteId: 'abc', hostUrl: 'https://a.test' });
    store.destroy();
    fetchMock.mockClear();
    window.history.pushState(null, '', '/after');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-exports the framework-agnostic singleton', () => {
    expect(typeof umami.init).toBe('function');
    expect(typeof umami.track).toBe('function');
  });
});
