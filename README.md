# @zachlagden/umami-sdk

Lightweight, type-safe SDK for [Umami](https://umami.is) analytics (v2). Native transport, no external script, works in any browser app.

> One install, multiple tree-shakeable entry points: core browser SDK, a server-side sender (`@zachlagden/umami-sdk/node`), framework adapters (React, Next, Vue, Svelte, Solid, Astro), and a reporting API client (`@zachlagden/umami-sdk/api`).

## Install

```bash
pnpm add @zachlagden/umami-sdk
```

## Quick start

```ts
import { umami } from '@zachlagden/umami-sdk';

umami.init({
  websiteId: 'your-website-id',
  hostUrl: 'https://analytics.example.com',
});

umami.track('signup', { plan: 'pro' });
umami.identify('user-123', { tier: 'gold' });
```

Or create an isolated instance:

```ts
import { createUmami } from '@zachlagden/umami-sdk';

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

## React (`@zachlagden/umami-sdk/react`)

```tsx
import { UmamiProvider, useUmami } from '@zachlagden/umami-sdk/react';

function App() {
  return (
    <UmamiProvider config={{ websiteId: '...', hostUrl: 'https://analytics.example.com' }}>
      <Page />
    </UmamiProvider>
  );
}

function Page() {
  const umami = useUmami();
  return <button onClick={() => umami.track('signup', { plan: 'pro' })}>Sign up</button>;
}
```

`<UmamiProvider>` creates the tracker on mount (auto-tracking SPA pageviews) and tears it down on unmount. `react` is an optional peer dependency.

## Next.js (`@zachlagden/umami-sdk/next`)

App Router — drop `<UmamiAnalytics />` into your root layout. It tracks the initial pageview and every route change (via `usePathname`/`useSearchParams`):

```tsx
// app/layout.tsx
import { UmamiAnalytics } from '@zachlagden/umami-sdk/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <UmamiAnalytics websiteId="..." hostUrl="https://analytics.example.com" />
      </body>
    </html>
  );
}
```

The component ships with the `'use client'` directive, so it drops straight into a Server Component layout. Pages Router users can use `<UmamiProvider>` from `@zachlagden/umami-sdk/react` instead.

## Vue (`@zachlagden/umami-sdk/vue`)

```ts
import { createApp } from 'vue';
import { umamiPlugin } from '@zachlagden/umami-sdk/vue';

const app = createApp(App);
app.use(umamiPlugin, { websiteId: '...', hostUrl: 'https://analytics.example.com' });
```

```vue
<script setup lang="ts">
import { useUmami } from '@zachlagden/umami-sdk/vue';
const umami = useUmami();
</script>

<template>
  <button @click="umami.track('signup', { plan: 'pro' })">Sign up</button>
</template>
```

The plugin auto-tracks SPA pageviews (vue-router uses the History API) and tears down on app unmount. `vue` is an optional peer dependency.

## Svelte / SvelteKit (`@zachlagden/umami-sdk/svelte`)

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createUmamiStore } from '@zachlagden/umami-sdk/svelte';

  const umami = createUmamiStore({ websiteId: '...', hostUrl: 'https://analytics.example.com' });
  onDestroy(umami.destroy);
</script>

<button on:click={() => $umami.track('signup', { plan: 'pro' })}>Sign up</button>
```

`createUmamiStore` returns a Svelte store, so `$umami` is the tracker instance. SPA pageviews are auto-tracked via the History API. The framework-agnostic singleton is also re-exported: `import { umami } from '@zachlagden/umami-sdk/svelte'`. `svelte` is an optional peer dependency.

## Solid (`@zachlagden/umami-sdk/solid`)

```tsx
import { UmamiProvider, useUmami } from '@zachlagden/umami-sdk/solid';

function App() {
  return (
    <UmamiProvider config={{ websiteId: '...', hostUrl: 'https://analytics.example.com' }}>
      <Page />
    </UmamiProvider>
  );
}

function Page() {
  const umami = useUmami();
  return <button onClick={() => umami.track('signup', { plan: 'pro' })}>Sign up</button>;
}
```

The provider creates the tracker and disposes it via `onCleanup`. SPA pageviews are auto-tracked via the History API. `solid-js` is an optional peer dependency.

## Astro (`@zachlagden/umami-sdk/astro`)

Add the integration to `astro.config.mjs` — it injects tracking into every page:

```ts
import { defineConfig } from 'astro/config';
import umami from '@zachlagden/umami-sdk/astro';

export default defineConfig({
  integrations: [umami({ websiteId: '...', hostUrl: 'https://analytics.example.com' })],
});
```

Works with MPA navigation and View Transitions (the core's History tracking covers soft navigations). `beforeSend` isn't supported through the integration (it can't be serialized into the injected script) — use the core SDK directly if you need it.

## Server-side (`@zachlagden/umami-sdk/node`)

Fire events from Node with explicit request context:

```ts
import { createUmami } from '@zachlagden/umami-sdk/node';

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
import { track } from '@zachlagden/umami-sdk/node';
await track({ websiteId: '...', hostUrl: '...', url: '/p', name: 'signup' });
```

`url` can be an absolute URL or a path; `hostname` is derived from the URL (or `hostUrl`) when omitted. Requires Node ≥ 18.

## Reporting API (`@zachlagden/umami-sdk/api`)

Read your analytics back out — for dashboards, reports, or exports. Supports Umami Cloud (API key) and self-hosted (username/password or a bearer token):

```ts
import { createUmamiApiClient } from '@zachlagden/umami-sdk/api';

// Umami Cloud
const cloud = createUmamiApiClient({ apiKey: process.env.UMAMI_API_KEY! });

// Self-hosted (logs in lazily and caches the token)
const client = createUmamiApiClient({
  apiEndpoint: 'https://analytics.example.com',
  username: 'admin',
  password: process.env.UMAMI_PASSWORD!,
});

const websites = await client.getWebsites();
const stats = await client.getStats('website-id', { startAt: Date.now() - 7 * 864e5, endAt: Date.now() });
const top = await client.getMetrics('website-id', { startAt, endAt, type: 'referrer', limit: 10 });
const series = await client.getPageviews('website-id', { startAt, endAt, unit: 'day', timezone: 'UTC' });
const live = await client.getActiveVisitors('website-id');
```

Unlike the tracker (which never throws), the API client **throws `UmamiApiError`** (with `.status` and `.body`) on a failed request, so callers can handle errors. `startAt`/`endAt` are epoch milliseconds.

## Notes

- `data-umami-event` works on **any** element (not only `<a>`/`<button>`) — put it on a wrapper `<div>` if you like.
- Known limitation: `excludeSearch`/`excludeHash` are applied to the page `url`, but not yet to the *referrer* of an SPA navigation.

## License

MIT
