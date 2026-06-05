// @vitest-environment-options { "url": "https://example.com/" }
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApp, defineComponent, h } from 'vue';
import { umamiPlugin, useUmami } from '../src/vue/index';
import type { UmamiConfig, UmamiInstance } from '../src/core/types';

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

function body(call: number) {
  return JSON.parse((fetchMock.mock.calls[call]![1] as { body: string }).body);
}

function mountWith(config: UmamiConfig, onSetup: (umami: UmamiInstance) => void) {
  const Comp = defineComponent({
    setup() {
      onSetup(useUmami());
      return () => h('div');
    },
  });
  const app = createApp(Comp);
  app.use(umamiPlugin, config);
  app.mount(document.createElement('div'));
  return app;
}

describe('vue adapter', () => {
  it('provides an instance via the plugin; useUmami can track', async () => {
    let umami!: UmamiInstance;
    mountWith({ websiteId: 'abc', hostUrl: 'https://a.test', autoTrack: false }, (u) => {
      umami = u;
    });
    await umami.track('e', { a: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body(0).payload.name).toBe('e');
    expect(body(0).payload.data).toEqual({ a: 1 });
  });

  it('auto-tracks the initial pageview when autoTrack is on', () => {
    mountWith({ websiteId: 'abc', hostUrl: 'https://a.test' }, () => {});
    expect(fetchMock).toHaveBeenCalled();
    expect(body(0).type).toBe('event');
  });

  it('useUmami throws when the plugin is not installed', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => useUmami()).toThrow(/plugin/);
    spy.mockRestore();
  });
});
