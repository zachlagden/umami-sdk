// @vitest-environment-options { "url": "https://example.com/" }
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

let mockPathname = '/';
let mockSearch = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearch,
}));

import { UmamiAnalytics } from '../src/next/index';

const fetchMock = vi.fn(async (..._args: unknown[]) => ({ json: async () => ({}) }));

beforeEach(() => {
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
  window.history.replaceState(null, '', 'https://example.com/');
  mockPathname = '/';
  mockSearch = new URLSearchParams('');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function body(call: number) {
  return JSON.parse((fetchMock.mock.calls[call]![1] as { body: string }).body);
}

describe('UmamiAnalytics (Next App Router)', () => {
  it('fires a pageview on mount', () => {
    render(<UmamiAnalytics websiteId="abc" hostUrl="https://a.test" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body(0).type).toBe('event');
    expect(body(0).payload.website).toBe('abc');
    expect(body(0).payload.name).toBeUndefined();
  });

  it('fires another pageview when the route changes', () => {
    const { rerender } = render(<UmamiAnalytics websiteId="abc" hostUrl="https://a.test" />);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    act(() => {
      mockPathname = '/next-page';
      rerender(<UmamiAnalytics websiteId="abc" hostUrl="https://a.test" />);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not double-count via the core history auto-tracker', () => {
    render(<UmamiAnalytics websiteId="abc" hostUrl="https://a.test" />);
    fetchMock.mockClear();
    act(() => {
      window.history.pushState(null, '', '/raw-history');
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
