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
