# umami-sdk — Design Spec

- **Date:** 2026-06-04
- **Status:** Approved (design), pending implementation plan
- **Package:** `umami-sdk` (npm, unscoped)
- **Target:** Umami **v2** — self-hosted and Umami Cloud
- **Reference tracker:** `docs/reference/umami-tracker-v2.pretty.js` (captured from https://insights.digigrow.uk/script.js, 2026-06-04)

## 1. Summary

A lightweight, type-safe, framework-agnostic SDK for Umami v2. One package with
multiple subpath entry points (tree-shakeable). The core reimplements Umami's
tracker natively in TypeScript — it builds the `/api/send` payload and POSTs it
directly, with no external script. The same core powers browser tracking,
server-side tracking, and thin framework adapters.

### Goals

- Native transport with **exact payload/header parity** with the official v2 tracker.
- One install, subpath exports: `umami-sdk`, `/react`, `/next`, `/vue`, `/svelte`, `/solid`, `/astro`, `/node`.
- Lightweight: core < 2KB gzip, each adapter < 1KB gzip on top (enforced in CI).
- Works in any browser app, any SSR/Node runtime, and feels native in each framework.
- Full TypeScript types, dual ESM + CJS builds.

### Non-goals (v1)

- Reporting API client (read-side). `umami-sdk/api` subpath is **reserved** for a future version; internals must not preclude it.
- localStorage offline persistence (in-memory queue only).
- Official-`script.js` wrap mode.

## 2. Background — verified Umami v2 tracker behavior

All facts below are taken from the live tracker (see reference artifact). The SDK
must match these exactly.

### 2.1 Endpoint & transport

- **Endpoint:** `${hostUrl}/api/send` (if `hostUrl` omitted, the tracker derives it from the script origin; in our SDK `hostUrl` is required for browser unless a relative `/api/send` is acceptable — see §6).
- **Method:** `POST`, `fetch(endpoint, { method, body, headers, keepalive: true, credentials })`.
- **`keepalive: true`** is always set (no `sendBeacon`). Reliable for in-flight requests during unload.
- **`credentials`**: configurable, default `'omit'`.
- **Headers:**
  - `Content-Type: application/json`
  - `x-umami-cache: <token>` — only included once a token exists (after the first response).
- **Body:** `JSON.stringify({ type, payload })` where `type` is `'event'` or `'identify'`.

### 2.2 Response handling

Response JSON is `{ cache?: string, disabled?: boolean }`.

- `cache` → stored and replayed as `x-umami-cache` on subsequent requests (lets the server skip session re-lookup; a real perf win).
- `disabled === true` → set an internal `disabled` flag; all subsequent sends are blocked.
- Network errors are swallowed silently (analytics must never throw into the host app).

### 2.3 Payload shape

Default payload (function `R()` in the reference) is:

```ts
{
  website: string;     // website id
  screen: string;      // `${width}x${height}`
  language: string;    // navigator.language
  title: string;       // document.title
  hostname: string;    // location.hostname
  url: string;         // normalized absolute URL (see 2.4)
  referrer: string;    // normalized referrer ('' if same-origin)
  tag?: string;        // optional campaign tag
  id?: string;         // identify id; present on every event once set
}
```

For a **custom event**: `{ ...R(), name: eventName, data: eventData }`, sent with `type: 'event'`.
For **identify**: `{ ...R(), data: sessionData }`, sent with `type: 'identify'`.

### 2.4 URL normalization (`P()` in reference)

```
P(input) = new URL(input, location.href)
           → optionally clear `.search` if excludeSearch
           → optionally clear `.hash` if excludeHash
           → `.toString()`   (full absolute URL)
           → on throw, return input unchanged
```

The tracker sends the **full absolute URL** (post-normalization), not just the path.
Referrer is `''` when `document.referrer` starts with the page origin (same-origin).

### 2.5 `track()` overloads (function `J`)

```ts
track('event-name', data?)   // → { ...R(), name, data }, type 'event'
track({ ...customPayload })  // → sends the object as the payload verbatim
track(payload => modified)   // → callback receives R(), returns the payload to send
track()                      // → pageview (default payload R())
```

### 2.6 `identify()` overloads (function `q`)

```ts
identify(uniqueId: string)                 // sets internal id, data = undefined
identify(uniqueId: string, data: object)   // sets id, attaches data
identify({ ...sessionData })               // data = object, id unchanged
```

- Setting a string id persists it (`id` rides on all future payloads via `R()`).
- `identify` **resets the cache token** to `''` before sending.

### 2.7 Config attributes (data-* parity → SDK options)

| Tracker attribute        | SDK option           | Default   |
|--------------------------|----------------------|-----------|
| `data-website-id`        | `websiteId`          | required  |
| `data-host-url`          | `hostUrl`            | recommended (browser; falls back to relative `/api/send`); required (Node) |
| `data-auto-track`        | `autoTrack`          | `true`    |
| `data-tag`               | `tag`                | `undefined` |
| `data-do-not-track`      | `respectDNT`         | `false`   |
| `data-exclude-search`    | `excludeSearch`      | `false`   |
| `data-exclude-hash`      | `excludeHash`        | `false`   |
| `data-domains`           | `domains`            | `undefined` (no restriction) |
| `data-before-send`       | `beforeSend`         | `undefined` |
| `data-fetch-credentials` | `fetchCredentials`   | `'omit'`  |

### 2.8 Block rules (function `B`)

A send is blocked if **any** of:

- server returned `disabled: true` previously, or
- no `websiteId`, or
- `localStorage['umami.disabled']` is set (opt-out), or
- `domains` is set and `location.hostname` is not in it, or
- `respectDNT` is true and DNT is enabled (`doNotTrack`/`msDoNotTrack` is `1`/`'1'`/`'yes'`).

### 2.9 Auto-tracking details

- Initial pageview fires once the document is `complete`.
- `history.pushState`/`replaceState` are monkey-patched: on a URL change, the previous URL becomes the referrer, and a pageview fires **300ms later** (`setTimeout`, lets `document.title` settle).
- **Declarative click tracking:** clicks on `a`/`button` carrying `data-umami-event="name"` auto-fire an event; any `data-umami-event-<key>="value"` attributes become the event `data`. Anchor default-navigation is deferred until the event send resolves (unless modifier/new-tab click).
- `beforeSend(type, payload)` runs before every send; returning a falsy value drops the event.

## 3. Package architecture

Single package, subpath exports. `package.json` highlights:

- `"type": "module"`, `"sideEffects": false`.
- Dual build: ESM + CJS + `.d.ts` per entry, via **tsup**.
- `exports` map with one entry per subpath, each exposing `types`/`import`/`require`, plus `browser`/`node` conditions where they diverge (core has a browser env collector; node has an explicit-context one).
- Framework libs (`react`, `vue`, `svelte`, `solid-js`, `astro`) are **optional `peerDependencies`** + `peerDependenciesMeta.optional`. They are never bundled; a consumer only pulls what they import.
- `engines.node >= 18` (global `fetch`).

```
umami-sdk            → core browser SDK (singleton + createUmami)
umami-sdk/react      → <UmamiProvider>, useUmami()
umami-sdk/next       → <UmamiAnalytics /> (App + Pages Router)
umami-sdk/vue        → plugin + useUmami()
umami-sdk/svelte     → store + <UmamiAnalytics/> + SvelteKit nav helper
umami-sdk/solid      → provider + useUmami()
umami-sdk/astro      → <Umami /> component + integration
umami-sdk/node       → server-side track()/createUmami() with explicit context
umami-sdk/api        → RESERVED (reporting client; future)
```

## 4. Core modules

Each module has one job and a small, testable interface.

- **`core/types.ts`** — `UmamiConfig`, `EventPayload`, `IdentifyData`, `BeforeSend`, `UmamiInstance`, transport types.
- **`core/payload.ts`** — pure builder: `(config, env, overrides) → payload`. Includes URL normalization `normalizeUrl()` mirroring `P()`. Fully unit-tested; no I/O.
- **`core/environment.ts`** — `getBrowserEnvironment()` reads `screen`, `navigator.language`, `document.title`, `location.hostname`, `location.href`, `document.referrer`. A separate `node` env factory takes explicit context (see §7). Returns a plain `Environment` object so `payload.ts` stays pure.
- **`core/transport.ts`** — `send(endpoint, { type, payload }, { credentials, cacheToken })` → POST with `keepalive`, `application/json`, optional `x-umami-cache`; parses `{ cache, disabled }`; never throws. Pluggable `fetch` (injectable for tests and Node).
- **`core/queue.ts`** — buffers events fired before `init()` or while offline; flushes in order on init / `online`. In-memory only.
- **`core/privacy.ts`** — `isBlocked(config, env)` implementing §2.8; `disable()`/`enable()` toggling `localStorage['umami.disabled']`; DNT detection.
- **`core/autotrack.ts`** — History API patching (`pushState`/`replaceState` + `popstate`), 300ms-delayed SPA pageview, and the optional declarative `data-umami-event` click listener. Returns a cleanup function.
- **`core/instance.ts`** — `createUmami(config)`: wires the modules, holds mutable state (`cacheToken`, `disabled`, `identifyId`), exposes the public API (§5), and manages auto-track lifecycle.
- **`index.ts`** — exports `createUmami`, types, and a lazily-initialized default singleton (`umami`).

## 5. Public API

```ts
interface UmamiConfig {
  websiteId: string;
  hostUrl?: string;                 // required in browser unless same-origin /api/send
  autoTrack?: boolean;              // default true
  tag?: string;
  respectDNT?: boolean;             // default false
  excludeSearch?: boolean;          // default false
  excludeHash?: boolean;            // default false
  domains?: string[];
  fetchCredentials?: RequestCredentials; // default 'omit'
  beforeSend?: (type: 'event' | 'identify', payload: EventPayload) => EventPayload | null | undefined | false;
  dataAttributes?: boolean;         // enable declarative data-umami-event clicks; default true in browser
}

interface UmamiInstance {
  track(): Promise<void>;                                    // pageview
  track(eventName: string, data?: Record<string, unknown>): Promise<void>;
  track(payload: Partial<EventPayload>): Promise<void>;
  track(fn: (defaults: EventPayload) => Partial<EventPayload>): Promise<void>;
  identify(uniqueId: string, data?: Record<string, unknown>): Promise<void>;
  identify(data: Record<string, unknown>): Promise<void>;
  enable(): void;
  disable(): void;
  readonly disabled: boolean;
}

function createUmami(config: UmamiConfig): UmamiInstance;

// default singleton for quick use
const umami: UmamiInstance & { init(config: UmamiConfig): UmamiInstance };
```

All `track`/`identify` calls resolve (never reject) — failures are swallowed. Calls
before `init` are queued.

## 6. Configuration notes

- **`hostUrl`**: in the browser, if omitted, transport falls back to a relative `/api/send` (useful when the app is served from the Umami host / behind a proxy). In Node, `hostUrl` is required.
- **`autoTrack`**: when `true` (default) the core sets up History patching + initial pageview. Framework adapters that wire the router set `autoTrack: false` on the core and drive pageviews themselves to avoid double counting.

## 7. Server-side — `umami-sdk/node`

Same `payload.ts` + `transport.ts`, but environment is **explicit** (no DOM).

```ts
import { createUmami, track } from 'umami-sdk/node';

await track('purchase', { amount: 49 }, {
  websiteId, hostUrl,
  url: '/checkout',
  hostname: 'example.com',          // optional; derived from hostUrl if absent
  referrer: 'https://google.com',   // optional
  title: 'Checkout',                // optional
  language: 'en-US',                // optional
  userAgent: req.headers['user-agent'], // forwarded as User-Agent header
  ip: req.ip,                           // forwarded as X-Forwarded-For (geo/session)
});
```

- Node transport sets the `User-Agent` header and `X-Forwarded-For` from the call
  context so Umami attributes device/geo/session correctly (the server can't read
  them otherwise).
- No auto-tracking, no queue persistence concerns — each call is a discrete send.
- `createUmami(defaults)` lets a server hold shared config and pass per-call context.

## 8. Framework adapters

All adapters are thin wrappers over `createUmami`, contributing < 1KB each.

- **React (`/react`)** — `<UmamiProvider config>` creates an instance in context; `useUmami()` → `{ track, identify, enable, disable }`. Router-agnostic (no pageview wiring beyond optional manual `track()`).
- **Next (`/next`)** — `<UmamiAnalytics />` client component. App Router: `usePathname` + `useSearchParams` → fire pageview on change. Pages Router: subscribe to `router.events('routeChangeComplete')`. Sets `autoTrack: false` on the core. Mirrors `@vercel/analytics` ergonomics.
- **Vue 3 (`/vue`)** — `app.use(umamiPlugin, config)`; `useUmami()` composable via `inject`. Optional `vue-router` guard for auto pageviews. Covers Nuxt via the plugin.
- **Svelte / SvelteKit (`/svelte`)** — a readable store wrapping the instance + `<UmamiAnalytics />` component; SvelteKit uses `afterNavigate` to fire pageviews.
- **Solid (`/solid`)** — context provider + `useUmami()` primitive; `@solidjs/router` `useLocation` effect for pageviews.
- **Astro (`/astro`)** — `<Umami />` component injecting an inline initializer; handles MPA navigations and `astro:page-load` (View Transitions). Optional integration export for config injection.

Each adapter delegates all transport/payload logic to the core — no duplicated send code.

## 9. Reserved — reporting API client (future)

`umami-sdk/api` is declared in the `exports` map but ships as a typed stub that
throws "not implemented in v1". The core's transport/types are written so a
read-side client (auth → token, websites, stats/metrics/events queries) can be
added without touching tracking code.

## 10. Testing strategy

- **Runner:** `vitest`. **DOM:** `happy-dom`.
- **`payload.ts`**: exhaustive unit tests — every overload, URL normalization, exclude-search/hash, identify id persistence, tag.
- **`transport.ts`**: mocked `fetch`; assert headers (`application/json`, `x-umami-cache` replay), `keepalive`, credentials, cache/disabled response handling, error swallowing.
- **`privacy.ts`**: each block rule in §2.8; opt-out localStorage; DNT variants.
- **`autotrack.ts`**: pushState/replaceState → 300ms pageview; declarative click events.
- **Adapters**: one integration test each with the framework's testing utils (`@testing-library/react`, `@vue/test-utils`, etc.) asserting an instance is created and `track` reaches a mocked transport.
- **Node**: mock server / fetch; assert `User-Agent` + `X-Forwarded-For`.

## 11. Build, size, tooling

- **Build:** `tsup` (ESM + CJS + dts, per entry, minified).
- **Size budget:** `size-limit` config with per-entry limits (core < 2KB, adapters < 1KB each); runnable in CI.
- **Lint/format:** project default (eslint + prettier) — keep light.
- **Package manager:** `pnpm`.

## 12. Versioning, license, changelog

- Starts at **0.1.0** (pre-1.0 semver; surface may refine before 1.0).
- **MIT** license.
- `CHANGELOG.md` (keep-a-changelog), `[Unreleased]` kept empty after each cut.

## 13. Suggested build order (for the implementation plan)

1. **Foundation:** repo scaffold, `package.json` exports map, tsup/vitest/size-limit, `types.ts`, `payload.ts` (+ tests), `transport.ts` (+ tests).
2. **Browser core:** `environment.ts`, `privacy.ts`, `queue.ts`, `instance.ts`, default singleton, `index.ts` (+ tests).
3. **Auto-tracking:** `autotrack.ts` — History patching + declarative clicks (+ tests).
4. **Node:** `node/index.ts` explicit-context env + UA/IP headers (+ tests).
5. **Adapters:** React → Next → Vue → Svelte → Solid → Astro (each + a smoke test).
6. **Polish:** `umami-sdk/api` stub, README (with framework quickstarts), size-limit gate, CHANGELOG, examples.

## 14. Risks / open questions

- **URL = full absolute vs path:** the live tracker sends the full normalized URL. We match it. (If a target server expects a path, that's its concern; we mirror official behavior.)
- **`x-umami-cache` schema** could change across Umami minor versions; transport treats it as an opaque token, which is forward-safe.
- **Astro** auto-tracking across View Transitions vs. classic MPA needs a small amount of runtime branching — handled in the inline initializer.
- **Adapter peer dep ranges:** pick permissive ranges (React 18+, Vue 3+, Svelte 4+, Solid 1+, Astro 4+) and validate at implementation time.

## Appendix

- Verified reference: `docs/reference/umami-tracker-v2.pretty.js` (and `.min.js`).
- Source: https://insights.digigrow.uk/script.js — Umami v2 — captured 2026-06-04.
