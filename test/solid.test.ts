// @vitest-environment-options { "url": "https://example.com/" }
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';
import { UmamiProvider, useUmami } from '../src/solid/index';

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

describe('solid adapter', () => {
  it('exports a provider and a hook', () => {
    expect(typeof UmamiProvider).toBe('function');
    expect(typeof useUmami).toBe('function');
  });

  it('creates a tracker (initial pageview) within a root and tears down on dispose', () => {
    createRoot((dispose) => {
      UmamiProvider({ config: { websiteId: 'abc', hostUrl: 'https://a.test' }, children: undefined });
      expect(fetchMock).toHaveBeenCalled();
      const sentBody = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
      expect(sentBody.type).toBe('event');
      dispose();
    });
    fetchMock.mockClear();
    window.history.pushState(null, '', '/after-dispose');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('useUmami throws when used outside a provider', () => {
    expect(() => useUmami()).toThrow(/UmamiProvider/);
  });
});
