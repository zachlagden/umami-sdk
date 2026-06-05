// @vitest-environment-options { "url": "https://example.com/" }
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { UmamiProvider, useUmami } from '../src/react/index';

const fetchMock = vi.fn(async (..._args: unknown[]) => ({ json: async () => ({}) }));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
  window.history.replaceState(null, '', 'https://example.com/');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function TrackButton() {
  const umami = useUmami();
  return <button onClick={() => umami.track('clicked', { a: 1 })}>go</button>;
}

describe('UmamiProvider / useUmami', () => {
  it('fires the initial pageview on mount', () => {
    render(
      <UmamiProvider config={{ websiteId: 'abc', hostUrl: 'https://a.test' }}>
        <span>ok</span>
      </UmamiProvider>,
    );
    expect(fetchMock).toHaveBeenCalled();
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.type).toBe('event');
    expect(body.payload.website).toBe('abc');
  });

  it('provides a working instance; track reaches the network', async () => {
    render(
      <UmamiProvider config={{ websiteId: 'abc', hostUrl: 'https://a.test' }}>
        <TrackButton />
      </UmamiProvider>,
    );
    fetchMock.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByText('go'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body);
    expect(body.payload.name).toBe('clicked');
    expect(body.payload.data).toEqual({ a: 1 });
  });

  it('useUmami throws when used outside a provider', () => {
    function Lonely() {
      useUmami();
      return null;
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Lonely />)).toThrow(/UmamiProvider/);
    spy.mockRestore();
  });

  it('tears down the instance on unmount (no pageview after unmount navigation)', () => {
    const { unmount } = render(
      <UmamiProvider config={{ websiteId: 'abc', hostUrl: 'https://a.test' }}>
        <span>ok</span>
      </UmamiProvider>,
    );
    unmount();
    fetchMock.mockClear();
    window.history.pushState(null, '', '/after-unmount');
    // core uses a 300ms delayed pageview; even immediately, the patch should be removed
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
