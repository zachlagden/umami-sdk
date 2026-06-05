import { describe, it, expect, vi } from 'vitest';
import { createUmamiApiClient, UmamiApiError } from '../src/api/index';

function res(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function calls(fn: ReturnType<typeof vi.fn>) {
  return fn.mock.calls as Array<[string, RequestInit & { headers: Record<string, string> }]>;
}

describe('umami api client', () => {
  it('cloud: hits the v1 base with the x-umami-api-key header', async () => {
    const fetchFn = vi.fn(async () => res({ data: [], count: 0, page: 1, pageSize: 10 }));
    const client = createUmamiApiClient({ apiKey: 'KEY', fetchFn: fetchFn as unknown as typeof fetch });
    await client.getWebsites();
    const [url, init] = calls(fetchFn)[0]!;
    expect(url).toBe('https://api.umami.is/v1/websites');
    expect(init.headers['x-umami-api-key']).toBe('KEY');
  });

  it('self-hosted token: uses the /api prefix, Bearer header, and query params', async () => {
    const fetchFn = vi.fn(async () => res({ pageviews: 10, visitors: 5, visits: 7, bounces: 2, totaltime: 99 }));
    const client = createUmamiApiClient({
      apiEndpoint: 'https://host.test/',
      token: 'TOK',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await client.getStats('w1', { startAt: 1000, endAt: 2000 });
    const [url, init] = calls(fetchFn)[0]!;
    expect(url).toBe('https://host.test/api/websites/w1/stats?startAt=1000&endAt=2000');
    expect(init.headers.Authorization).toBe('Bearer TOK');
  });

  it('self-hosted login: logs in once, then reuses the token', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(res({ token: 'JWT' }))
      .mockResolvedValueOnce(res({ visitors: 3 }))
      .mockResolvedValueOnce(res({ visitors: 4 }));
    const client = createUmamiApiClient({
      apiEndpoint: 'https://host.test',
      username: 'u',
      password: 'p',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await client.getActiveVisitors('w1');
    await client.getActiveVisitors('w1');

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(calls(fetchFn)[0]![0]).toBe('https://host.test/api/auth/login');
    expect(JSON.parse(calls(fetchFn)[0]![1].body as string)).toEqual({ username: 'u', password: 'p' });
    expect(calls(fetchFn)[1]![0]).toBe('https://host.test/api/websites/w1/active');
    expect(calls(fetchFn)[1]![1].headers.Authorization).toBe('Bearer JWT');
  });

  it('throws UmamiApiError on a non-2xx response', async () => {
    const fetchFn = vi.fn(async () => res({ message: 'Unauthorized' }, false, 401));
    const client = createUmamiApiClient({ apiKey: 'KEY', fetchFn: fetchFn as unknown as typeof fetch });
    await expect(client.getWebsites()).rejects.toBeInstanceOf(UmamiApiError);
    await expect(client.getWebsites()).rejects.toMatchObject({ status: 401 });
  });

  it('builds metrics and events/series paths with params', async () => {
    const fetchFn = vi.fn(async () => res([]));
    const client = createUmamiApiClient({
      apiEndpoint: 'https://host.test',
      token: 'T',
      fetchFn: fetchFn as unknown as typeof fetch,
    });
    await client.getMetrics('w1', { startAt: 1, endAt: 2, type: 'browser', limit: 10 });
    expect(calls(fetchFn)[0]![0]).toBe('https://host.test/api/websites/w1/metrics?startAt=1&endAt=2&type=browser&limit=10');

    await client.getEventsSeries('w1', { startAt: 1, endAt: 2, unit: 'day', timezone: 'UTC' });
    expect(calls(fetchFn)[1]![0]).toBe(
      'https://host.test/api/websites/w1/events/series?startAt=1&endAt=2&unit=day&timezone=UTC',
    );
  });
});
