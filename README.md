# umami-sdk

Lightweight, type-safe SDK for [Umami](https://umami.is) analytics (v2). Native transport, no external script, works in any browser app.

> Ships today: core browser SDK, a server-side sender (`umami-sdk/node`), and React, Next, Vue, Svelte, and Solid adapters. An Astro integration follows.

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

## React (`umami-sdk/react`)

```tsx
import { UmamiProvider, useUmami } from 'umami-sdk/react';

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

## Next.js (`umami-sdk/next`)

App Router — drop `<UmamiAnalytics />` into your root layout. It tracks the initial pageview and every route change (via `usePathname`/`useSearchParams`):

```tsx
// app/layout.tsx
import { UmamiAnalytics } from 'umami-sdk/next';

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

The component ships with the `'use client'` directive, so it drops straight into a Server Component layout. Pages Router users can use `<UmamiProvider>` from `umami-sdk/react` instead.

## Vue (`umami-sdk/vue`)

```ts
import { createApp } from 'vue';
import { umamiPlugin } from 'umami-sdk/vue';

const app = createApp(App);
app.use(umamiPlugin, { websiteId: '...', hostUrl: 'https://analytics.example.com' });
```

```vue
<script setup lang="ts">
import { useUmami } from 'umami-sdk/vue';
const umami = useUmami();
</script>

<template>
  <button @click="umami.track('signup', { plan: 'pro' })">Sign up</button>
</template>
```

The plugin auto-tracks SPA pageviews (vue-router uses the History API) and tears down on app unmount. `vue` is an optional peer dependency.

## Svelte / SvelteKit (`umami-sdk/svelte`)

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createUmamiStore } from 'umami-sdk/svelte';

  const umami = createUmamiStore({ websiteId: '...', hostUrl: 'https://analytics.example.com' });
  onDestroy(umami.destroy);
</script>

<button on:click={() => $umami.track('signup', { plan: 'pro' })}>Sign up</button>
```

`createUmamiStore` returns a Svelte store, so `$umami` is the tracker instance. SPA pageviews are auto-tracked via the History API. The framework-agnostic singleton is also re-exported: `import { umami } from 'umami-sdk/svelte'`. `svelte` is an optional peer dependency.

## Solid (`umami-sdk/solid`)

```tsx
import { UmamiProvider, useUmami } from 'umami-sdk/solid';

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

## Notes

- `data-umami-event` works on **any** element (not only `<a>`/`<button>`) — put it on a wrapper `<div>` if you like.
- Known limitation: `excludeSearch`/`excludeHash` are applied to the page `url`, but not yet to the *referrer* of an SPA navigation.

## License

MIT
