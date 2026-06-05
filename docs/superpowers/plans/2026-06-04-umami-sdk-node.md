# umami-sdk Server-Side Sender (`umami-sdk/node`) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a server-side tracking entry point `umami-sdk/node` that fires Umami v2 events from Node with explicit request context (URL, User-Agent, IP), reusing the existing pure payload builder and transport.

**Architecture:** A self-contained `src/node/index.ts` that imports ONLY `core/payload.ts` (pure), `core/transport.ts`, and `core/types.ts` — no DOM modules (`environment`, `privacy`, `autotrack`, `instance`), so the node entry carries no `window` references and stays tiny. It builds an `Environment` from explicit options, builds the payload, runs `beforeSend`, and POSTs via `send()` with `User-Agent`/`X-Forwarded-For` headers. Each call uses a fresh transport state (no cache-token sharing — server requests are different visitors).

**Tech Stack:** TypeScript (strict), tsup multi-entry, vitest, size-limit. Node ≥ 18 (global `fetch`; undici allows setting `User-Agent`, unlike browsers).

**Spec:** `docs/superpowers/specs/2026-06-04-umami-sdk-design.md` §7. API shape refined to a single options object (cleaner for server use; consistent `track`/`identify`).

**Depends on:** the merged core (`payload.ts`, `transport.ts`, `types.ts` already on `main`).

---

## File Structure

```
src/node/index.ts      # createUmami + track/identify (instance + standalone)
test/node.test.ts      # node sender tests (mocked fetch)
package.json           # add "./node" export
tsup.config.ts         # add node entry
.size-limit.json       # add node budget
README.md / CHANGELOG.md  # document node usage
```

---

## Task 1: Wire the `/node` entry into the build

**Files:** Modify `package.json`, `tsup.config.ts`, `.size-limit.json`; Create placeholder `src/node/index.ts`

- [ ] **Step 1: Create placeholder `src/node/index.ts`** (so the build has an entry)

```ts
export const NODE_ENTRY = true;
```

- [ ] **Step 2: Add the `./node` subpath to `package.json` `exports`** (insert after the `"."` entry, before `"./package.json"`):

```json
    "./node": {
      "types": "./dist/node.d.ts",
      "import": "./dist/node.js",
      "require": "./dist/node.cjs"
    },
```

- [ ] **Step 3: Add the node entry to `tsup.config.ts`** — change the `entry` line to:

```ts
  entry: { index: 'src/index.ts', node: 'src/node/index.ts' },
```

- [ ] **Step 4: Add a node budget to `.size-limit.json`** (add a second array element):

```json
  {
    "name": "umami-sdk/node",
    "path": "dist/node.js",
    "limit": "2 KB",
    "gzip": true
  }
```

- [ ] **Step 5: Build and verify both entries emit**

Run: `pnpm build`
Expected: `dist/index.js`, `dist/index.cjs`, `dist/node.js`, `dist/node.cjs`, `dist/node.d.ts` all emitted.

- [ ] **Step 6: Commit**

```bash
git add package.json tsup.config.ts .size-limit.json src/node/index.ts
git commit -m "build: add umami-sdk/node entry point"
```

---

## Task 2: Implement the node sender (TDD)

**Files:** Modify `src/node/index.ts` (replace placeholder); Test `test/node.test.ts`

- [ ] **Step 1: Write `test/node.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { createUmami, track, identify } from '../src/node/index';

function mockFetch() {
  return vi.fn(async () => ({ json: async () => ({}) })) as unknown as typeof fetch;
}
function lastCall(fetchFn: typeof fetch) {
  const call = (fetchFn as any).mock.calls.at(-1);
  return { url: call[0] as string, init: call[1] as RequestInit & { headers: Record<string, string> } };
}
function body(fetchFn: typeof fetch) {
  return JSON.parse(lastCall(fetchFn).init.body as string);
}

describe('node createUmami', () => {
  it('POSTs to {hostUrl}/api/send with an event payload', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.track({ url: 'https://site.com/checkout' });
    expect(lastCall(fetchFn).url).toBe('https://a.test/api/send');
    expect(body(fetchFn)).toEqual({
      type: 'event',
      payload: expect.objectContaining({
        website: 'abc',
        url: 'https://site.com/checkout',
        hostname: 'site.com',
      }),
    });
    expect(body(fetchFn).payload.name).toBeUndefined();
  });

  it('sends a named event with data', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.track({ url: '/checkout', name: 'purchase', data: { amount: 49 } });
    expect(body(fetchFn).payload.name).toBe('purchase');
    expect(body(fetchFn).payload.data).toEqual({ amount: 49 });
  });

  it('forwards userAgent as User-Agent and ip as X-Forwarded-For', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.track({ url: '/p', userAgent: 'Mozilla/5.0 test', ip: '203.0.113.7' });
    const { init } = lastCall(fetchFn);
    expect(init.headers['User-Agent']).toBe('Mozilla/5.0 test');
    expect(init.headers['X-Forwarded-For']).toBe('203.0.113.7');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('derives hostname from hostUrl when url is a path, and explicit hostname wins', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://analytics.test', fetchFn });
    await umami.track({ url: '/p' });
    expect(body(fetchFn).payload.hostname).toBe('analytics.test');
    await umami.track({ url: '/p', hostname: 'shop.test' });
    expect(body(fetchFn).payload.hostname).toBe('shop.test');
  });

  it('identify sends type identify with id and data', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.identify({ id: 'user-1', url: '/p', data: { tier: 'gold' } });
    expect(body(fetchFn).type).toBe('identify');
    expect(body(fetchFn).payload.id).toBe('user-1');
    expect(body(fetchFn).payload.data).toEqual({ tier: 'gold' });
  });

  it('attaches id to a tracked event when provided', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await umami.track({ url: '/p', name: 'click', id: 'user-9' });
    expect(body(fetchFn).payload.id).toBe('user-9');
  });

  it('beforeSend can drop the event', async () => {
    const fetchFn = mockFetch();
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn, beforeSend: () => null });
    await umami.track({ url: '/p' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('never rejects when fetch throws', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('network'); }) as unknown as typeof fetch;
    const umami = createUmami({ websiteId: 'abc', hostUrl: 'https://a.test', fetchFn });
    await expect(umami.track({ url: '/p' })).resolves.toBeUndefined();
  });
});

describe('node standalone helpers', () => {
  it('track() accepts inline websiteId + hostUrl', async () => {
    const fetchFn = mockFetch();
    await track({ websiteId: 'abc', hostUrl: 'https://a.test', url: '/p', name: 'e', fetchFn });
    expect(lastCall(fetchFn).url).toBe('https://a.test/api/send');
    expect(body(fetchFn).payload.name).toBe('e');
  });

  it('identify() accepts inline websiteId + hostUrl', async () => {
    const fetchFn = mockFetch();
    await identify({ websiteId: 'abc', hostUrl: 'https://a.test', id: 'u1', url: '/p', data: { a: 1 }, fetchFn });
    expect(body(fetchFn).type).toBe('identify');
    expect(body(fetchFn).payload.id).toBe('u1');
  });
});
```

- [ ] **Step 2: Run the test → expect FAIL** (the placeholder has no `createUmami`/`track`/`identify`)

Run: `pnpm vitest run test/node.test.ts`
Expected: FAIL — no matching exports.

- [ ] **Step 3: Replace `src/node/index.ts`**

```ts
import type { EventPayload, Environment, BeforeSend, SendType, UmamiConfig } from '../core/types';
import { buildBasePayload } from '../core/payload';
import { send, type TransportState } from '../core/transport';

export interface NodeUmamiConfig {
  websiteId: string;
  hostUrl: string;
  tag?: string;
  excludeSearch?: boolean;
  excludeHash?: boolean;
  fetchCredentials?: RequestCredentials;
  beforeSend?: BeforeSend;
  fetchFn?: typeof fetch;
}

export interface NodeTrackOptions {
  url: string;
  name?: string;
  data?: Record<string, unknown>;
  id?: string;
  hostname?: string;
  referrer?: string;
  title?: string;
  language?: string;
  screen?: string;
  tag?: string;
  userAgent?: string;
  ip?: string;
}

export interface NodeIdentifyOptions extends Omit<NodeTrackOptions, 'name'> {
  id: string;
}

export interface NodeUmamiInstance {
  track(options: NodeTrackOptions): Promise<void>;
  identify(options: NodeIdentifyOptions): Promise<void>;
}

function tryHostname(value: string): string | undefined {
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

export function createUmami(config: NodeUmamiConfig): NodeUmamiInstance {
  const endpoint = `${config.hostUrl.replace(/\/$/, '')}/api/send`;
  const credentials = config.fetchCredentials ?? 'omit';
  const fetchFn = config.fetchFn;

  async function dispatch(type: SendType, options: NodeTrackOptions): Promise<void> {
    const env: Environment = {
      hostname: options.hostname ?? tryHostname(options.url) ?? tryHostname(config.hostUrl) ?? '',
      screen: options.screen ?? '',
      language: options.language ?? '',
      title: options.title ?? '',
      url: options.url,
      referrer: options.referrer ?? '',
    };
    const baseConfig: UmamiConfig = {
      websiteId: config.websiteId,
      hostUrl: config.hostUrl,
      tag: options.tag ?? config.tag,
      excludeSearch: config.excludeSearch,
      excludeHash: config.excludeHash,
    };
    const payload: EventPayload = buildBasePayload(baseConfig, env, options.id);
    if (type === 'event' && options.name !== undefined) {
      payload.name = options.name;
      payload.data = options.data;
    } else if (type === 'identify') {
      payload.data = options.data;
    }

    const finalPayload = config.beforeSend ? config.beforeSend(type, payload) : payload;
    if (!finalPayload) return;

    const headers: Record<string, string> = {};
    if (options.userAgent) headers['User-Agent'] = options.userAgent;
    if (options.ip) headers['X-Forwarded-For'] = options.ip;

    const state: TransportState = { disabled: false };
    await send({ endpoint, type, payload: finalPayload, credentials, state, fetchFn, headers });
  }

  return {
    track(options: NodeTrackOptions): Promise<void> {
      return dispatch('event', options);
    },
    identify(options: NodeIdentifyOptions): Promise<void> {
      return dispatch('identify', options);
    },
  };
}

type Inline = { websiteId: string; hostUrl: string; beforeSend?: BeforeSend; fetchFn?: typeof fetch };

export function track(options: NodeTrackOptions & Inline): Promise<void> {
  const { websiteId, hostUrl, beforeSend, fetchFn, ...rest } = options;
  return createUmami({ websiteId, hostUrl, beforeSend, fetchFn }).track(rest);
}

export function identify(options: NodeIdentifyOptions & Inline): Promise<void> {
  const { websiteId, hostUrl, beforeSend, fetchFn, ...rest } = options;
  return createUmami({ websiteId, hostUrl, beforeSend, fetchFn }).identify(rest as NodeIdentifyOptions);
}
```

- [ ] **Step 4: Run the test → expect PASS** (all cases)

Run: `pnpm vitest run test/node.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all green (core 49 + node ~10).

- [ ] **Step 6: Commit**

```bash
git add src/node/index.ts test/node.test.ts
git commit -m "feat: add server-side node sender (track/identify with UA + IP)"
```

---

## Task 3: Docs + final verification

**Files:** Modify `README.md`, `CHANGELOG.md`

- [ ] **Step 1: Add a server-side section to `README.md`** — insert just before the `## Notes` section:

````markdown
## Server-side (`umami-sdk/node`)

Fire events from Node with explicit request context:

```ts
import { createUmami } from 'umami-sdk/node';

const umami = createUmami({
  websiteId: 'your-website-id',
  hostUrl: 'https://analytics.example.com',
});

await umami.track({
  url: '/checkout',
  name: 'purchase',
  data: { amount: 49 },
  userAgent: req.headers['user-agent'], // → User-Agent header (device/browser)
  ip: req.ip,                           // → X-Forwarded-For (geo/session)
});

await umami.identify({ id: 'user-123', url: '/checkout', data: { tier: 'gold' } });
```

Or a one-off with inline config:

```ts
import { track } from 'umami-sdk/node';
await track({ websiteId: '...', hostUrl: '...', url: '/p', name: 'signup' });
```

`url` can be an absolute URL or a path; `hostname` is derived from the URL (or `hostUrl`) when omitted. Requires Node ≥ 18.
````

- [ ] **Step 2: Update `CHANGELOG.md`** — add under `## [Unreleased]`:

```markdown
### Added
- `umami-sdk/node` — server-side sender with explicit request context (`url`, `userAgent` → `User-Agent`, `ip` → `X-Forwarded-For`); `createUmami`, `track`, `identify`.
```

- [ ] **Step 3: Final verification**

Run: `pnpm test && pnpm typecheck && pnpm build && pnpm size`
Expected: all tests pass; build emits index + node entries; size budgets (core < 3 KB, node < 2 KB gzip) pass. Record the node gzip number.

- [ ] **Step 4: Commit**

```bash
git add README.md CHANGELOG.md
git commit -m "docs: document umami-sdk/node server-side usage"
```

---

## Self-Review (plan author)

- **Spec §7 coverage:** explicit context (url/hostname/referrer/title/language/userAgent/ip) → Task 2 `NodeTrackOptions`; `User-Agent` + `X-Forwarded-For` forwarding → Task 2 `dispatch`; reuse of `payload.ts`/`transport.ts` → Task 2 imports; `createUmami(defaults)` + standalone `track` → Task 2. Node ≥ 18 noted.
- **No DOM imports:** node imports only `core/payload`, `core/transport`, `core/types` (none reference `window`), keeping the entry DOM-free. Verified by the import list in Task 2 Step 3.
- **Placeholder scan:** none — full code/tests/commands provided.
- **Type consistency:** `NodeUmamiConfig`, `NodeTrackOptions`, `NodeIdentifyOptions`, `NodeUmamiInstance`, `Inline` defined once; `dispatch(type, options)` signature consistent; reuses existing `buildBasePayload(config, env, id)` and `send(SendOptions)` exactly as defined on `main`.
