# umami-sdk Core Browser SDK — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core, framework-agnostic browser tracking SDK for Umami v2 (`umami-sdk`), matching the official v2 tracker's payload/transport exactly, with full TypeScript types and tests.

**Architecture:** Native transport — small single-responsibility modules under `src/core/` (pure payload builder, fetch transport, DOM environment reader, privacy/block rules, before-init queue, history auto-tracking, and an instance orchestrator) plus a default singleton in `src/index.ts`. Everything is dependency-injected so it's unit-testable in `happy-dom`.

**Tech Stack:** TypeScript (strict), tsup (ESM+CJS+dts), vitest + happy-dom, size-limit, pnpm.

**Reference:** `docs/reference/umami-tracker-v2.pretty.js` is the ground-truth tracker. The spec is `docs/superpowers/specs/2026-06-04-umami-sdk-design.md`. Re-read §2 of the spec for exact tracker behavior.

**Scope of THIS plan:** spec phases 1–3 (foundation, browser core, auto-tracking). Node sender and framework adapters are separate follow-on plans. This plan produces a complete, publishable browser SDK on its own.

**Intentional deviations from the raw tracker (documented, compatibility-safe):**
- The object/function `track()` overloads **merge** onto the default payload (so `website` etc. are always present) instead of sending verbatim. Strictly safer DX; the wire payload still carries every required field.
- Declarative `data-umami-event` clicks do **not** defer anchor navigation. We rely on `fetch({ keepalive: true })` to deliver the event during navigation — simpler and can't hang a click.

---

## File Structure

```
src/
  core/
    types.ts        # all shared types/interfaces
    payload.ts      # pure: URL normalization + payload builder
    transport.ts    # fetch POST, headers, x-umami-cache, response handling
    environment.ts  # DOM environment reader
    privacy.ts      # DNT, opt-out, block rules
    queue.ts        # before-init buffer
    autotrack.ts    # history patching + declarative clicks
    instance.ts     # createUmami orchestrator (+ offline buffer)
  index.ts          # default singleton + public re-exports
test/
  payload.test.ts
  transport.test.ts
  environment.test.ts
  privacy.test.ts
  queue.test.ts
  instance.test.ts
  singleton.test.ts
  autotrack.test.ts
```

---

## Task 0: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.size-limit.json`, `src/index.ts` (temporary), `test/smoke.test.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "umami-sdk",
  "version": "0.1.0",
  "description": "Lightweight, type-safe SDK for Umami analytics — works everywhere.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "size": "size-limit"
  },
  "keywords": ["umami", "analytics", "tracking", "privacy", "sdk", "typescript"],
  "devDependencies": {
    "@size-limit/preset-small-lib": "^11.1.6",
    "happy-dom": "^15.7.4",
    "size-limit": "^11.1.6",
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 3: Create `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  minify: true,
  treeshake: true,
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
```

- [ ] **Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
```

- [ ] **Step 5: Create `.size-limit.json`**

```json
[
  {
    "name": "umami-sdk core",
    "path": "dist/index.js",
    "limit": "3 KB",
    "gzip": true
  }
]
```

- [ ] **Step 6: Create temporary `src/index.ts`**

```ts
export const VERSION = '0.1.0';
```

- [ ] **Step 7: Create `test/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index';

describe('scaffold', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
```

- [ ] **Step 8: Install dependencies**

Run: `pnpm install`
Expected: dependencies installed, `pnpm-lock.yaml` created.

- [ ] **Step 9: Verify test + build + typecheck run**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: 1 test passes, no type errors, `dist/index.js` + `dist/index.cjs` + `dist/index.d.ts` emitted.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold umami-sdk package (tsup, vitest, size-limit)"
```

---

## Task 1: Shared types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Write `src/core/types.ts`**

```ts
export type SendType = 'event' | 'identify';

export interface EventPayload {
  website: string;
  hostname?: string;
  screen?: string;
  language?: string;
  title?: string;
  url?: string;
  referrer?: string;
  tag?: string;
  id?: string;
  name?: string;
  data?: Record<string, unknown>;
}

export type BeforeSend = (
  type: SendType,
  payload: EventPayload,
) => EventPayload | null | undefined | false;

export interface UmamiConfig {
  websiteId: string;
  hostUrl?: string;
  autoTrack?: boolean;
  tag?: string;
  respectDNT?: boolean;
  excludeSearch?: boolean;
  excludeHash?: boolean;
  domains?: string[];
  fetchCredentials?: RequestCredentials;
  beforeSend?: BeforeSend;
  dataAttributes?: boolean;
}

export interface Environment {
  hostname: string;
  screen: string;
  language: string;
  title: string;
  url: string;
  referrer: string;
}

export interface UmamiInstance {
  track(): Promise<void>;
  track(eventName: string, data?: Record<string, unknown>): Promise<void>;
  track(payload: Partial<EventPayload>): Promise<void>;
  track(fn: (defaults: EventPayload) => Partial<EventPayload>): Promise<void>;
  identify(uniqueId: string, data?: Record<string, unknown>): Promise<void>;
  identify(data: Record<string, unknown>): Promise<void>;
  enable(): void;
  disable(): void;
  readonly disabled: boolean;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm typecheck`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat: add core types"
```

---

## Task 2: Payload builder (pure)

**Files:**
- Create: `src/core/payload.ts`
- Test: `test/payload.test.ts`

- [ ] **Step 1: Write the failing test `test/payload.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { normalizeUrl, normalizeReferrer, buildBasePayload } from '../src/core/payload';
import type { Environment, UmamiConfig } from '../src/core/types';

const env: Environment = {
  hostname: 'example.com',
  screen: '1920x1080',
  language: 'en-US',
  title: 'Home',
  url: 'https://example.com/page?q=1#h',
  referrer: 'https://google.com/',
};
const config: UmamiConfig = { websiteId: 'abc' };

describe('normalizeUrl', () => {
  it('returns empty input unchanged', () => {
    expect(normalizeUrl('', undefined, {})).toBe('');
  });
  it('returns absolute url unchanged', () => {
    expect(normalizeUrl('https://x.com/a?b=1', undefined, {})).toBe('https://x.com/a?b=1');
  });
  it('strips search when excludeSearch', () => {
    expect(normalizeUrl('https://x.com/a?b=1#h', undefined, { excludeSearch: true })).toBe('https://x.com/a#h');
  });
  it('strips hash when excludeHash', () => {
    expect(normalizeUrl('https://x.com/a?b=1#h', undefined, { excludeHash: true })).toBe('https://x.com/a?b=1');
  });
  it('resolves relative against base', () => {
    expect(normalizeUrl('/p', 'https://x.com', {})).toBe('https://x.com/p');
  });
  it('returns input unchanged on parse failure', () => {
    expect(normalizeUrl('::::', undefined, {})).toBe('::::');
  });
});

describe('normalizeReferrer', () => {
  it('returns empty for empty referrer', () => {
    expect(normalizeReferrer('', 'https://example.com', {})).toBe('');
  });
  it('returns empty for same-origin referrer', () => {
    expect(normalizeReferrer('https://example.com/x', 'https://example.com', {})).toBe('');
  });
  it('returns cross-origin referrer normalized', () => {
    expect(normalizeReferrer('https://google.com/', 'https://example.com', {})).toBe('https://google.com/');
  });
});

describe('buildBasePayload', () => {
  it('maps environment + config into the umami payload', () => {
    const p = buildBasePayload(config, env);
    expect(p).toEqual({
      website: 'abc',
      hostname: 'example.com',
      screen: '1920x1080',
      language: 'en-US',
      title: 'Home',
      url: 'https://example.com/page?q=1#h',
      referrer: 'https://google.com/',
      tag: undefined,
      id: undefined,
    });
  });
  it('includes tag and id when present', () => {
    const p = buildBasePayload({ ...config, tag: 'launch' }, env, 'user-1');
    expect(p.tag).toBe('launch');
    expect(p.id).toBe('user-1');
  });
  it('applies excludeSearch/excludeHash to url', () => {
    const p = buildBasePayload({ ...config, excludeSearch: true, excludeHash: true }, env);
    expect(p.url).toBe('https://example.com/page');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/payload.test.ts`
Expected: FAIL — cannot find module `../src/core/payload`.

- [ ] **Step 3: Write `src/core/payload.ts`**

```ts
import type { EventPayload, Environment, UmamiConfig } from './types';

interface NormalizeOpts {
  excludeSearch?: boolean;
  excludeHash?: boolean;
}

export function normalizeUrl(input: string, base: string | undefined, opts: NormalizeOpts): string {
  if (!input) return input;
  try {
    const u = new URL(input, base);
    if (opts.excludeSearch) u.search = '';
    if (opts.excludeHash) u.hash = '';
    return u.toString();
  } catch {
    return input;
  }
}

export function normalizeReferrer(referrer: string, origin: string | undefined, opts: NormalizeOpts): string {
  if (!referrer) return '';
  if (origin && referrer.startsWith(origin)) return '';
  return normalizeUrl(referrer, undefined, opts);
}

function originOf(href: string): string | undefined {
  try {
    return new URL(href).origin;
  } catch {
    return undefined;
  }
}

export function buildBasePayload(config: UmamiConfig, env: Environment, id?: string): EventPayload {
  const opts: NormalizeOpts = {
    excludeSearch: config.excludeSearch,
    excludeHash: config.excludeHash,
  };
  return {
    website: config.websiteId,
    hostname: env.hostname,
    screen: env.screen,
    language: env.language,
    title: env.title,
    url: normalizeUrl(env.url, env.url, opts),
    referrer: normalizeReferrer(env.referrer, originOf(env.url), opts),
    tag: config.tag,
    id: id || undefined,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/payload.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/payload.ts test/payload.test.ts
git commit -m "feat: add pure payload builder with url normalization"
```

---

## Task 3: Transport

**Files:**
- Create: `src/core/transport.ts`
- Test: `test/transport.test.ts`

- [ ] **Step 1: Write the failing test `test/transport.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { send, type TransportState } from '../src/core/transport';
import type { EventPayload } from '../src/core/types';

const payload: EventPayload = { website: 'abc', url: 'https://e.com/' };

function mockFetch(responseBody: unknown) {
  return vi.fn(async () => ({
    json: async () => responseBody,
  })) as unknown as typeof fetch;
}

describe('send', () => {
  it('POSTs application/json with keepalive and the {type, payload} body', async () => {
    const fetchFn = mockFetch({});
    const state: TransportState = { disabled: false };
    await send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchFn as any).mock.calls[0];
    expect(url).toBe('/api/send');
    expect(init.method).toBe('POST');
    expect(init.keepalive).toBe(true);
    expect(init.credentials).toBe('omit');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['x-umami-cache']).toBeUndefined();
    expect(JSON.parse(init.body)).toEqual({ type: 'event', payload });
  });

  it('stores cache token and replays it as x-umami-cache', async () => {
    const fetchFn = mockFetch({ cache: 'tok-1' });
    const state: TransportState = { disabled: false };
    await send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn });
    expect(state.cacheToken).toBe('tok-1');

    await send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn });
    const init = (fetchFn as any).mock.calls[1][1];
    expect(init.headers['x-umami-cache']).toBe('tok-1');
  });

  it('sets disabled flag when server returns disabled', async () => {
    const fetchFn = mockFetch({ disabled: true });
    const state: TransportState = { disabled: false };
    await send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn });
    expect(state.disabled).toBe(true);
  });

  it('swallows fetch errors', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    const state: TransportState = { disabled: false };
    await expect(
      send({ endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn }),
    ).resolves.toBeUndefined();
  });

  it('merges extra headers (for node UA/XFF)', async () => {
    const fetchFn = mockFetch({});
    const state: TransportState = { disabled: false };
    await send({
      endpoint: '/api/send', type: 'event', payload, credentials: 'omit', state, fetchFn,
      headers: { 'User-Agent': 'node', 'X-Forwarded-For': '1.2.3.4' },
    });
    const init = (fetchFn as any).mock.calls[0][1];
    expect(init.headers['User-Agent']).toBe('node');
    expect(init.headers['X-Forwarded-For']).toBe('1.2.3.4');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/transport.test.ts`
Expected: FAIL — cannot find module `../src/core/transport`.

- [ ] **Step 3: Write `src/core/transport.ts`**

```ts
import type { EventPayload, SendType } from './types';

export interface TransportState {
  cacheToken?: string;
  disabled: boolean;
}

export interface SendOptions {
  endpoint: string;
  type: SendType;
  payload: EventPayload;
  credentials: RequestCredentials;
  state: TransportState;
  fetchFn?: typeof fetch;
  headers?: Record<string, string>;
}

interface SendResponse {
  cache?: string;
  disabled?: boolean;
}

export async function send(opts: SendOptions): Promise<void> {
  const { endpoint, type, payload, credentials, state } = opts;
  const fetchFn = opts.fetchFn ?? fetch;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(state.cacheToken !== undefined ? { 'x-umami-cache': state.cacheToken } : {}),
    ...opts.headers,
  };

  try {
    const res = await fetchFn(endpoint, {
      method: 'POST',
      body: JSON.stringify({ type, payload }),
      headers,
      keepalive: true,
      credentials,
    });
    const data = (await res.json().catch(() => undefined)) as SendResponse | undefined;
    if (data) {
      if (typeof data.cache === 'string') state.cacheToken = data.cache;
      if (data.disabled) state.disabled = true;
    }
  } catch {
    // Analytics must never throw into the host app.
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/transport.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/transport.ts test/transport.test.ts
git commit -m "feat: add fetch transport with cache-token and disabled handling"
```

---

## Task 4: DOM environment reader

**Files:**
- Create: `src/core/environment.ts`
- Test: `test/environment.test.ts`

- [ ] **Step 1: Write the failing test `test/environment.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { getBrowserEnvironment } from '../src/core/environment';

describe('getBrowserEnvironment', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', 'https://example.com/page');
    document.title = 'My Title';
  });

  it('reads hostname, screen, language, title, url', () => {
    const env = getBrowserEnvironment();
    expect(env.hostname).toBe('example.com');
    expect(env.screen).toMatch(/^\d+x\d+$/);
    expect(typeof env.language).toBe('string');
    expect(env.title).toBe('My Title');
    expect(env.url).toBe('https://example.com/page');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/environment.test.ts`
Expected: FAIL — cannot find module `../src/core/environment`.

- [ ] **Step 3: Write `src/core/environment.ts`**

```ts
import type { Environment } from './types';

export function getBrowserEnvironment(): Environment {
  const { screen, navigator, location, document } = window;
  return {
    hostname: location.hostname,
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language,
    title: document.title,
    url: location.href,
    referrer: document.referrer,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/environment.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/environment.ts test/environment.test.ts
git commit -m "feat: add DOM environment reader"
```

---

## Task 5: Privacy / block rules

**Files:**
- Create: `src/core/privacy.ts`
- Test: `test/privacy.test.ts`

- [ ] **Step 1: Write the failing test `test/privacy.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { isBlocked, isOptedOut, setOptOut } from '../src/core/privacy';
import type { Environment, UmamiConfig } from '../src/core/types';

const env: Environment = {
  hostname: 'example.com',
  screen: '1x1', language: 'en', title: '', url: 'https://example.com/', referrer: '',
};

beforeEach(() => {
  window.localStorage.clear();
});

describe('opt-out', () => {
  it('round-trips the umami.disabled flag', () => {
    expect(isOptedOut()).toBe(false);
    setOptOut(true);
    expect(isOptedOut()).toBe(true);
    expect(window.localStorage.getItem('umami.disabled')).toBe('1');
    setOptOut(false);
    expect(isOptedOut()).toBe(false);
  });
});

describe('isBlocked', () => {
  it('blocks when server disabled', () => {
    expect(isBlocked({ websiteId: 'a' }, env, true)).toBe(true);
  });
  it('blocks when websiteId missing', () => {
    expect(isBlocked({ websiteId: '' }, env, false)).toBe(true);
  });
  it('blocks when opted out', () => {
    setOptOut(true);
    expect(isBlocked({ websiteId: 'a' }, env, false)).toBe(true);
  });
  it('blocks when hostname not in domains allow-list', () => {
    expect(isBlocked({ websiteId: 'a', domains: ['other.com'] }, env, false)).toBe(true);
  });
  it('allows when hostname is in domains allow-list', () => {
    expect(isBlocked({ websiteId: 'a', domains: ['example.com'] }, env, false)).toBe(false);
  });
  it('allows by default', () => {
    expect(isBlocked({ websiteId: 'a' }, env, false)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/privacy.test.ts`
Expected: FAIL — cannot find module `../src/core/privacy`.

- [ ] **Step 3: Write `src/core/privacy.ts`**

```ts
import type { UmamiConfig, Environment } from './types';

const DISABLE_KEY = 'umami.disabled';

export function isDoNotTrackEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = win.doNotTrack ?? nav.doNotTrack ?? nav.msDoNotTrack;
  return dnt === '1' || dnt === 'yes' || (dnt as unknown) === 1;
}

export function isOptedOut(): boolean {
  try {
    return !!window.localStorage.getItem(DISABLE_KEY);
  } catch {
    return false;
  }
}

export function setOptOut(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(DISABLE_KEY, '1');
    else window.localStorage.removeItem(DISABLE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function isBlocked(config: UmamiConfig, env: Environment, serverDisabled: boolean): boolean {
  if (serverDisabled) return true;
  if (!config.websiteId) return true;
  if (isOptedOut()) return true;
  if (config.domains && config.domains.length > 0 && !config.domains.includes(env.hostname)) return true;
  if (config.respectDNT && isDoNotTrackEnabled()) return true;
  return false;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/privacy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/privacy.ts test/privacy.test.ts
git commit -m "feat: add privacy block rules and opt-out"
```

---

## Task 6: Before-init queue

**Files:**
- Create: `src/core/queue.ts`
- Test: `test/queue.test.ts`

- [ ] **Step 1: Write the failing test `test/queue.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { EventQueue } from '../src/core/queue';

describe('EventQueue', () => {
  it('buffers until flush, then runs in order', () => {
    const calls: number[] = [];
    const q = new EventQueue();
    q.add(() => calls.push(1));
    q.add(() => calls.push(2));
    expect(calls).toEqual([]);
    q.flush();
    expect(calls).toEqual([1, 2]);
  });

  it('runs immediately after flush', () => {
    const fn = vi.fn();
    const q = new EventQueue();
    q.flush();
    q.add(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/queue.test.ts`
Expected: FAIL — cannot find module `../src/core/queue`.

- [ ] **Step 3: Write `src/core/queue.ts`**

```ts
export class EventQueue {
  private items: Array<() => void> = [];
  private flushed = false;

  add(fn: () => void): void {
    if (this.flushed) {
      fn();
      return;
    }
    this.items.push(fn);
  }

  flush(): void {
    this.flushed = true;
    const items = this.items;
    this.items = [];
    for (const fn of items) fn();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/queue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/queue.ts test/queue.test.ts
git commit -m "feat: add before-init event queue"
```

---

## Task 7: Instance orchestrator

**Files:**
- Create: `src/core/instance.ts`
- Test: `test/instance.test.ts`

Note: `createUmami` accepts an optional `deps` object so tests inject a fake environment, fetch, and online-state. Auto-tracking wiring is added in Task 10; this task leaves a placeholder call that is a no-op when `window` is absent in pure-node tests, but our tests pass `autoTrack: false` to avoid it entirely.

- [ ] **Step 1: Write the failing test `test/instance.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/instance.test.ts`
Expected: FAIL — cannot find module `../src/core/instance`.

- [ ] **Step 3: Write `src/core/instance.ts`**

```ts
import type { UmamiConfig, UmamiInstance, EventPayload, Environment, SendType } from './types';
import { buildBasePayload } from './payload';
import { send, type TransportState } from './transport';
import { getBrowserEnvironment } from './environment';
import { isBlocked, isOptedOut, setOptOut } from './privacy';

export interface UmamiDeps {
  getEnvironment?: () => Environment;
  fetchFn?: typeof fetch;
  isOnline?: () => boolean;
}

function resolveEndpoint(hostUrl?: string): string {
  const base = (hostUrl ?? '').replace(/\/$/, '');
  return `${base}/api/send`;
}

function defaultIsOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function createUmami(config: UmamiConfig, deps: UmamiDeps = {}): UmamiInstance {
  const getEnvironment = deps.getEnvironment ?? getBrowserEnvironment;
  const isOnline = deps.isOnline ?? defaultIsOnline;
  const fetchFn = deps.fetchFn;
  const credentials = config.fetchCredentials ?? 'omit';
  const endpoint = resolveEndpoint(config.hostUrl);
  const state: TransportState = { disabled: false };

  let identifyId: string | undefined;
  const offlineBuffer: Array<{ type: SendType; payload: EventPayload }> = [];
  let onlineListenerAttached = false;

  function base(): EventPayload {
    return buildBasePayload(config, getEnvironment(), identifyId);
  }

  function flushOffline(): void {
    if (!isOnline()) return;
    const items = offlineBuffer.splice(0, offlineBuffer.length);
    for (const item of items) {
      void send({ endpoint, type: item.type, payload: item.payload, credentials, state, fetchFn });
    }
  }

  function attachOnlineListener(): void {
    if (onlineListenerAttached || typeof window === 'undefined') return;
    onlineListenerAttached = true;
    window.addEventListener('online', flushOffline);
  }

  async function dispatch(type: SendType, payload: EventPayload): Promise<void> {
    if (isBlocked(config, getEnvironment(), state.disabled)) return;
    const finalPayload = config.beforeSend ? config.beforeSend(type, payload) : payload;
    if (!finalPayload) return;
    if (!isOnline()) {
      offlineBuffer.push({ type, payload: finalPayload });
      attachOnlineListener();
      return;
    }
    await send({ endpoint, type, payload: finalPayload, credentials, state, fetchFn });
  }

  const instance: UmamiInstance = {
    track(arg1?: unknown, arg2?: unknown): Promise<void> {
      const defaults = base();
      let payload: EventPayload;
      if (typeof arg1 === 'string') {
        payload = { ...defaults, name: arg1, data: arg2 as Record<string, unknown> | undefined };
      } else if (typeof arg1 === 'function') {
        const partial = (arg1 as (d: EventPayload) => Partial<EventPayload>)(defaults);
        payload = { ...defaults, ...partial };
      } else if (arg1 && typeof arg1 === 'object') {
        payload = { ...defaults, ...(arg1 as Partial<EventPayload>) };
      } else {
        payload = defaults;
      }
      return dispatch('event', payload);
    },
    identify(arg1: unknown, arg2?: unknown): Promise<void> {
      if (typeof arg1 === 'string') identifyId = arg1;
      const data =
        arg1 && typeof arg1 === 'object'
          ? (arg1 as Record<string, unknown>)
          : (arg2 as Record<string, unknown> | undefined);
      state.cacheToken = '';
      return dispatch('identify', { ...base(), data });
    },
    enable(): void {
      setOptOut(false);
    },
    disable(): void {
      setOptOut(true);
    },
    get disabled(): boolean {
      return state.disabled || isOptedOut();
    },
  };

  return instance;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/instance.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/instance.ts test/instance.test.ts
git commit -m "feat: add umami instance orchestrator with overloads and offline buffer"
```

---

## Task 8: Default singleton + public exports

**Files:**
- Modify: `src/index.ts` (replace the temporary scaffold)
- Test: `test/singleton.test.ts`

- [ ] **Step 1: Write the failing test `test/singleton.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/singleton.test.ts`
Expected: FAIL — `umami.reset` is not a function / cannot find exports.

- [ ] **Step 3: Replace `src/index.ts`**

```ts
import { createUmami, type UmamiDeps } from './core/instance';
import { EventQueue } from './core/queue';
import type { UmamiConfig, UmamiInstance } from './core/types';

export { createUmami };
export type { UmamiConfig, UmamiInstance, EventPayload, BeforeSend, SendType } from './core/types';

let instance: UmamiInstance | null = null;
let queue = new EventQueue();

function enqueue(call: (i: UmamiInstance) => Promise<void>): Promise<void> {
  if (instance) return call(instance);
  return new Promise<void>((resolve) => {
    queue.add(() => {
      void call(instance as UmamiInstance).then(resolve);
    });
  });
}

export const umami = {
  init(config: UmamiConfig, deps?: UmamiDeps): UmamiInstance {
    instance = createUmami(config, deps);
    queue.flush();
    return instance;
  },
  track(...args: [] | [string, Record<string, unknown>?] | [Partial<import('./core/types').EventPayload>] | [(d: import('./core/types').EventPayload) => Partial<import('./core/types').EventPayload>]): Promise<void> {
    return enqueue((i) => (i.track as (...a: unknown[]) => Promise<void>)(...args));
  },
  identify(...args: [string, Record<string, unknown>?] | [Record<string, unknown>]): Promise<void> {
    return enqueue((i) => (i.identify as (...a: unknown[]) => Promise<void>)(...args));
  },
  enable(): void {
    instance?.enable();
  },
  disable(): void {
    instance?.disable();
  },
  get disabled(): boolean {
    return instance ? instance.disabled : false;
  },
  reset(): void {
    instance = null;
    queue = new EventQueue();
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/singleton.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all tests PASS, no type errors. (Delete `test/smoke.test.ts` first if its scaffold export `VERSION` is gone — it is; remove it.)

```bash
git rm test/smoke.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add default singleton with before-init queue"
```

---

## Task 9: Auto-tracking module

**Files:**
- Create: `src/core/autotrack.ts`
- Test: `test/autotrack.test.ts`

- [ ] **Step 1: Write the failing test `test/autotrack.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupAutoTrack } from '../src/core/autotrack';
import type { UmamiInstance } from '../src/core/types';

function fakeInstance() {
  const track = vi.fn(async () => {});
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
    const { track } = fakeInstance();
    setupAutoTrack(fakeInstanceProxy(track));
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
    const fn = track.mock.calls[0][0] as (d: { url: string }) => unknown;
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

function fakeInstanceProxy(track: ReturnType<typeof vi.fn>): UmamiInstance {
  return { track, identify: vi.fn(), enable: vi.fn(), disable: vi.fn(), disabled: false } as unknown as UmamiInstance;
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run test/autotrack.test.ts`
Expected: FAIL — cannot find module `../src/core/autotrack`.

- [ ] **Step 3: Write `src/core/autotrack.ts`**

```ts
import type { UmamiInstance } from './types';

export interface AutoTrackHandle {
  stop(): void;
}

const SPA_PAGEVIEW_DELAY = 300;

function handleDataAttributeClick(e: MouseEvent, instance: UmamiInstance): void {
  const target = e.target as Element | null;
  const el = target?.closest('[data-umami-event]');
  if (!el) return;
  const name = el.getAttribute('data-umami-event');
  if (!name) return;
  const data: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    const m = attr.name.match(/^data-umami-event-(.+)$/);
    const key = m?.[1];
    if (key) data[key] = attr.value;
  }
  void instance.track(name, Object.keys(data).length > 0 ? data : undefined);
}

export function setupAutoTrack(
  instance: UmamiInstance,
  options: { dataAttributes?: boolean } = {},
): AutoTrackHandle {
  if (typeof window === 'undefined') return { stop() {} };

  const dataAttributes = options.dataAttributes ?? true;
  let lastUrl = window.location.href;
  const cleanups: Array<() => void> = [];

  const fireInitial = (): void => {
    void instance.track();
  };
  if (document.readyState === 'complete') {
    fireInitial();
  } else {
    const onReady = (): void => {
      if (document.readyState === 'complete') {
        fireInitial();
        document.removeEventListener('readystatechange', onReady, true);
      }
    };
    document.addEventListener('readystatechange', onReady, true);
    cleanups.push(() => document.removeEventListener('readystatechange', onReady, true));
  }

  const handleNav = (): void => {
    const current = window.location.href;
    if (current === lastUrl) return;
    const prev = lastUrl;
    lastUrl = current;
    setTimeout(() => {
      void instance.track((d) => ({ ...d, referrer: prev }));
    }, SPA_PAGEVIEW_DELAY);
  };

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function pushState(this: History, ...args: Parameters<History['pushState']>) {
    originalPush.apply(this, args);
    handleNav();
  };
  history.replaceState = function replaceState(this: History, ...args: Parameters<History['replaceState']>) {
    originalReplace.apply(this, args);
    handleNav();
  };
  window.addEventListener('popstate', handleNav);
  cleanups.push(() => {
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    window.removeEventListener('popstate', handleNav);
  });

  if (dataAttributes) {
    const onClick = (e: MouseEvent): void => handleDataAttributeClick(e, instance);
    document.addEventListener('click', onClick, true);
    cleanups.push(() => document.removeEventListener('click', onClick, true));
  }

  return {
    stop(): void {
      for (const fn of cleanups) fn();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/autotrack.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/autotrack.ts test/autotrack.test.ts
git commit -m "feat: add history auto-tracking and declarative click events"
```

---

## Task 10: Wire auto-tracking into the instance

**Files:**
- Modify: `src/core/instance.ts`
- Test: `test/instance.test.ts` (add a case)

- [ ] **Step 1: Add a failing test to `test/instance.test.ts`**

Append inside the `describe('createUmami', ...)` block:

```ts
  it('sets up auto-tracking by default (fires initial pageview)', async () => {
    const fetchFn = vi.fn(async () => ({ json: async () => ({}) })) as unknown as typeof fetch;
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    window.history.replaceState(null, '', 'https://example.com/auto');
    createUmami(
      { websiteId: 'abc', hostUrl: 'https://a.test' },
      { getEnvironment: () => ({ ...env, url: 'https://example.com/auto' }), fetchFn, isOnline: () => true },
    );
    await Promise.resolve();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not set up auto-tracking when autoTrack is false', async () => {
    const fetchFn = vi.fn(async () => ({ json: async () => ({}) })) as unknown as typeof fetch;
    createUmami(
      { websiteId: 'abc', hostUrl: 'https://a.test', autoTrack: false },
      { getEnvironment: () => env, fetchFn, isOnline: () => true },
    );
    await Promise.resolve();
    expect(fetchFn).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify the new cases fail**

Run: `pnpm vitest run test/instance.test.ts`
Expected: FAIL — the "sets up auto-tracking by default" case fails (fetch not called) because wiring is missing.

- [ ] **Step 3: Wire `setupAutoTrack` into `createUmami`**

In `src/core/instance.ts`, add the import at the top:

```ts
import { setupAutoTrack } from './autotrack';
```

Then, immediately before `return instance;` at the end of `createUmami`, add:

```ts
  if (config.autoTrack ?? true) {
    setupAutoTrack(instance, { dataAttributes: config.dataAttributes });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run test/instance.test.ts`
Expected: PASS (including the two new cases).

- [ ] **Step 5: Commit**

```bash
git add src/core/instance.ts test/instance.test.ts
git commit -m "feat: wire auto-tracking into createUmami"
```

---

## Task 11: Build, size budget, and typecheck gate

**Files:**
- Modify: `README.md` (create), `CHANGELOG.md` (create)

- [ ] **Step 1: Run the full verification**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all tests PASS, no type errors, `dist/` emits `index.js`, `index.cjs`, `index.d.ts`.

- [ ] **Step 2: Run the size check**

Run: `pnpm size`
Expected: `umami-sdk core` is under the 3 KB gzip limit. Record the actual number. If it exceeds, investigate before proceeding (it should be ~1.5–2.5 KB).

- [ ] **Step 3: Create `CHANGELOG.md`**

```markdown
# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org).

## [Unreleased]

## [0.1.0] - 2026-06-04

### Added
- Core browser tracking SDK for Umami v2 (`createUmami` + default `umami` singleton).
- Native `/api/send` transport with `application/json`, `keepalive`, `x-umami-cache` token replay, and server `disabled` handling.
- `track()` (pageview / named event / object / function overloads) and `identify()` with persisted id.
- Privacy: Do Not Track support, `umami.disabled` opt-out, `domains` allow-list, `beforeSend` hook.
- Auto-tracking: initial pageview, SPA history tracking, declarative `data-umami-event` clicks.
- Offline buffering with flush on reconnect; before-init call queue.
```

- [ ] **Step 4: Create `README.md`**

```markdown
# umami-sdk

Lightweight, type-safe SDK for [Umami](https://umami.is) analytics (v2). Native transport, no external script, works in any browser app.

> Framework adapters (React, Next, Vue, Svelte, Solid, Astro) and a server-side sender ship in follow-on releases.

## Install

```bash
pnpm add umami-sdk
```

## Quick start

```ts
import { umami } from 'umami-sdk';

umami.init({
  websiteId: 'your-website-id',
  hostUrl: 'https://analytics.example.com',
});

umami.track('signup', { plan: 'pro' });
umami.identify('user-123', { tier: 'gold' });
```

Or create an isolated instance:

```ts
import { createUmami } from 'umami-sdk';

const analytics = createUmami({ websiteId: '...', hostUrl: '...' });
analytics.track();
```

## Config

| Option | Default | Description |
| --- | --- | --- |
| `websiteId` | — | Required. Umami website id. |
| `hostUrl` | relative `/api/send` | Umami host. |
| `autoTrack` | `true` | Auto pageviews + SPA history tracking. |
| `tag` | — | Campaign tag attached to events. |
| `respectDNT` | `false` | Honor Do Not Track. |
| `excludeSearch` | `false` | Strip query string from URLs. |
| `excludeHash` | `false` | Strip hash from URLs. |
| `domains` | — | Only track on these hostnames. |
| `fetchCredentials` | `'omit'` | `fetch` credentials mode. |
| `beforeSend` | — | `(type, payload) => payload \| null` — mutate or drop. |
| `dataAttributes` | `true` | Track `data-umami-event` clicks. |

## Privacy

```ts
umami.disable(); // sets localStorage 'umami.disabled', stops tracking
umami.enable();  // resumes
```

## License

MIT
```

- [ ] **Step 5: Final full verification**

Run: `pnpm test && pnpm typecheck && pnpm build && pnpm size`
Expected: everything green.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: add README and CHANGELOG; verify build and size budget"
```

---

## Self-Review (completed by plan author)

**Spec coverage (spec §3–§13):**
- §3 package shape (core `.` export, ESM+CJS+dts, sideEffects) → Task 0.
- §4 core modules: payload → T2, transport → T3, environment → T4, privacy → T5, queue → T6, autotrack → T9, instance → T7/T10, index singleton → T8.
- §5 public API (config, instance overloads, singleton) → T1/T7/T8.
- §2.1–2.9 verified tracker behavior (endpoint, headers, cache, payload, url/referrer normalization, track/identify overloads, block rules, auto-track 300ms, declarative clicks) → T2/T3/T5/T7/T9.
- §10 testing strategy → every task is TDD; vitest + happy-dom; mocked fetch.
- §11 build/size/tooling → T0 + T11.
- §12 versioning/license/changelog → T0 (package.json 0.1.0, MIT) + T11 (CHANGELOG).
- Out of scope for this plan (per spec build order): node sender (§7) and adapters (§8) → separate plans. `umami-sdk/api` stub → ships with the node/adapters work.

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `EventPayload`, `UmamiConfig`, `UmamiInstance`, `Environment`, `TransportState`, `UmamiDeps` are defined once (T1/T3/T7) and reused verbatim. `createUmami(config, deps)` signature is identical across T7, T8, T10. `setupAutoTrack(instance, options)` matches between T9 and T10. `send(SendOptions)` matches between T3, T7. Singleton `umami.reset()` (used in tests) is defined in T8.
