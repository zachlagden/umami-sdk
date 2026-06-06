# Changelog

All notable changes to this project are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org).

## [Unreleased]

## [0.1.0] - 2026-06-06

### Added
- Core browser tracking SDK for Umami v2 (`createUmami` + default `umami` singleton).
- Native `/api/send` transport with `application/json`, `keepalive`, `x-umami-cache` token replay, and server `disabled` handling.
- `track()` (pageview / named event / object / function overloads) and `identify()` with persisted id.
- Privacy: Do Not Track support, `umami.disabled` opt-out, `domains` allow-list, `beforeSend` hook.
- Auto-tracking: initial pageview, SPA history tracking, declarative `data-umami-event` clicks.
- Offline buffering with flush on reconnect; before-init call queue.
- `@zachlagden/umami-sdk/node` — server-side sender with explicit request context (`url`, `userAgent` → `User-Agent`, `ip` → `X-Forwarded-For`); `createUmami`, `track`, `identify`.
- `@zachlagden/umami-sdk/react` — `<UmamiProvider>` + `useUmami()` hook; creates the tracker on mount and destroys it on unmount.
- `@zachlagden/umami-sdk/next` — `<UmamiAnalytics />` App Router component (ships `'use client'`); tracks initial pageview + route changes via `usePathname`/`useSearchParams`.
- `@zachlagden/umami-sdk/vue` — `umamiPlugin` + `useUmami()` composable; provides the tracker app-wide and destroys it on unmount.
- `@zachlagden/umami-sdk/svelte` — `createUmamiStore()` Svelte store (`$umami.track(...)`) + re-exported singleton.
- `@zachlagden/umami-sdk/solid` — `<UmamiProvider>` + `useUmami()` primitive; disposes the tracker via `onCleanup`.
- `@zachlagden/umami-sdk/astro` — Astro integration that injects tracking into every page.
- `@zachlagden/umami-sdk/api` — reporting/read client (`createUmamiApiClient`) for the Umami REST API: Cloud (`x-umami-api-key`) and self-hosted (login or bearer token) auth; `getWebsites`/`getWebsite`/`getActiveVisitors`/`getStats`/`getPageviews`/`getMetrics`/`getEventsSeries`; throws `UmamiApiError` on failure.
