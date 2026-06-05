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
