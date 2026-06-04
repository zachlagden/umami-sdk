// @vitest-environment-options { "url": "https://example.com/" }
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupAutoTrack } from '../src/core/autotrack';
import type { UmamiInstance } from '../src/core/types';

function fakeInstance() {
  const track = vi.fn(async (..._args: unknown[]) => {});
  const instance = {
    track, identify: vi.fn(async () => {}),
    enable: vi.fn(), disable: vi.fn(), disabled: false,
  } as unknown as UmamiInstance;
  return { instance, track };
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, '', 'https://example.com/start');
  Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
  document.body.innerHTML = '';
});

afterEach(() => {
  vi.useRealTimers();
});

describe('setupAutoTrack', () => {
  it('fires an initial pageview when document is complete', () => {
    const { instance, track } = fakeInstance();
    setupAutoTrack(instance);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith();
  });

  it('fires a delayed pageview with previous-url referrer on pushState', () => {
    const { instance, track } = fakeInstance();
    setupAutoTrack(instance);
    track.mockClear();
    window.history.pushState(null, '', '/next');
    expect(track).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(track).toHaveBeenCalledTimes(1);
    const fn = track.mock.calls[0]![0] as (d: { url: string }) => unknown;
    expect(typeof fn).toBe('function');
    expect(fn({ url: '/next' })).toMatchObject({ referrer: 'https://example.com/start' });
  });

  it('tracks declarative data-umami-event clicks', () => {
    const { instance, track } = fakeInstance();
    setupAutoTrack(instance);
    track.mockClear();
    document.body.innerHTML = '<button data-umami-event="cta" data-umami-event-pos="hero">Go</button>';
    (document.querySelector('button') as HTMLButtonElement).click();
    expect(track).toHaveBeenCalledWith('cta', { pos: 'hero' });
  });

  it('stop() removes history patches and listeners', () => {
    const { instance, track } = fakeInstance();
    const handle = setupAutoTrack(instance);
    handle.stop();
    track.mockClear();
    window.history.pushState(null, '', '/after-stop');
    vi.advanceTimersByTime(300);
    expect(track).not.toHaveBeenCalled();
  });
});
