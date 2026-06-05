export interface UmamiApiCloudConfig {
  apiKey: string;
  apiEndpoint?: string;
  fetchFn?: typeof fetch;
}

export interface UmamiApiLoginConfig {
  apiEndpoint: string;
  username: string;
  password: string;
  fetchFn?: typeof fetch;
}

export interface UmamiApiTokenConfig {
  apiEndpoint: string;
  token: string;
  fetchFn?: typeof fetch;
}

export type UmamiApiConfig = UmamiApiCloudConfig | UmamiApiLoginConfig | UmamiApiTokenConfig;

export class UmamiApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'UmamiApiError';
    this.status = status;
    this.body = body;
  }
}

export type TimeUnit = 'year' | 'month' | 'day' | 'hour' | 'minute';

export type MetricType =
  | 'path'
  | 'entry'
  | 'exit'
  | 'title'
  | 'query'
  | 'referrer'
  | 'channel'
  | 'domain'
  | 'country'
  | 'region'
  | 'city'
  | 'browser'
  | 'os'
  | 'device'
  | 'language'
  | 'screen'
  | 'event'
  | 'hostname'
  | 'tag'
  | 'distinctId';

export interface DateRangeParams {
  startAt: number;
  endAt: number;
}

export interface PageviewParams extends DateRangeParams {
  unit: TimeUnit;
  timezone: string;
  compare?: 'prev' | 'yoy';
}

export interface MetricParams extends DateRangeParams {
  type: MetricType;
  limit?: number;
  offset?: number;
  [filter: string]: unknown;
}

export interface EventsSeriesParams extends DateRangeParams {
  unit: TimeUnit;
  timezone: string;
}

export interface Website {
  id: string;
  name: string;
  domain: string;
  [key: string]: unknown;
}

export interface Paginated<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}

export interface WebsiteStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounces: number;
  totaltime: number;
  [key: string]: unknown;
}

export interface TimeSeriesPoint {
  x: string;
  y: number;
}

export interface PageviewsResult {
  pageviews: TimeSeriesPoint[];
  sessions: TimeSeriesPoint[];
}

export interface MetricItem {
  x: string | null;
  y: number;
}

export interface EventsSeriesItem {
  x: string;
  t: string;
  y: number;
}

export interface ActiveVisitors {
  visitors: number;
}

export interface UmamiApiClient {
  login(): Promise<string>;
  getWebsites(params?: Record<string, unknown>): Promise<Paginated<Website>>;
  getWebsite(websiteId: string): Promise<Website>;
  getActiveVisitors(websiteId: string): Promise<ActiveVisitors>;
  getStats(websiteId: string, params: DateRangeParams & Record<string, unknown>): Promise<WebsiteStats>;
  getPageviews(websiteId: string, params: PageviewParams): Promise<PageviewsResult>;
  getMetrics(websiteId: string, params: MetricParams): Promise<MetricItem[]>;
  getEventsSeries(websiteId: string, params: EventsSeriesParams): Promise<EventsSeriesItem[]>;
}

const CLOUD_ENDPOINT = 'https://api.umami.is/v1';

function isCloud(config: UmamiApiConfig): config is UmamiApiCloudConfig {
  return 'apiKey' in config && typeof config.apiKey === 'string';
}

function isLogin(config: UmamiApiConfig): config is UmamiApiLoginConfig {
  return 'username' in config && 'password' in config;
}

function isToken(config: UmamiApiConfig): config is UmamiApiTokenConfig {
  return 'token' in config && typeof config.token === 'string';
}

export function createUmamiApiClient(config: UmamiApiConfig): UmamiApiClient {
  const fetchFn = config.fetchFn ?? fetch;
  const cloud = isCloud(config);

  const root = (
    cloud ? (config.apiEndpoint ?? CLOUD_ENDPOINT) : (config as UmamiApiLoginConfig | UmamiApiTokenConfig).apiEndpoint
  ).replace(/\/$/, '');
  const dataBase = cloud ? root : `${root}/api`;

  let token: string | undefined = isToken(config) ? config.token : undefined;

  async function parse(res: Response): Promise<unknown> {
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string } | undefined)?.message ?? res.statusText);
      throw new UmamiApiError(res.status, `Umami API error ${res.status}: ${message}`, body);
    }
    return body;
  }

  async function doLogin(): Promise<string> {
    const c = config as UmamiApiLoginConfig;
    const res = await fetchFn(`${root}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: c.username, password: c.password }),
    });
    const data = await parse(res);
    const t = (data as { token?: string } | undefined)?.token;
    if (!t) {
      throw new UmamiApiError(res.status, 'Umami login did not return a token.', data);
    }
    return t;
  }

  async function authHeaders(): Promise<Record<string, string>> {
    if (cloud) {
      return { 'x-umami-api-key': config.apiKey };
    }
    if (!token && isLogin(config)) {
      token = await doLogin();
    }
    if (!token) {
      throw new UmamiApiError(401, 'No Umami API credentials available.');
    }
    return { Authorization: `Bearer ${token}` };
  }

  async function request<T>(path: string, params?: object): Promise<T> {
    const url = new URL(`${dataBase}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    const headers = await authHeaders();
    const res = await fetchFn(url.toString(), { headers });
    return (await parse(res)) as T;
  }

  return {
    async login(): Promise<string> {
      if (cloud) return config.apiKey;
      if (!token) token = await doLogin();
      return token;
    },
    getWebsites(params) {
      return request<Paginated<Website>>('/websites', params);
    },
    getWebsite(websiteId) {
      return request<Website>(`/websites/${websiteId}`);
    },
    getActiveVisitors(websiteId) {
      return request<ActiveVisitors>(`/websites/${websiteId}/active`);
    },
    getStats(websiteId, params) {
      return request<WebsiteStats>(`/websites/${websiteId}/stats`, params);
    },
    getPageviews(websiteId, params) {
      return request<PageviewsResult>(`/websites/${websiteId}/pageviews`, params);
    },
    getMetrics(websiteId, params) {
      return request<MetricItem[]>(`/websites/${websiteId}/metrics`, params);
    },
    getEventsSeries(websiteId, params) {
      return request<EventsSeriesItem[]>(`/websites/${websiteId}/events/series`, params);
    },
  };
}
