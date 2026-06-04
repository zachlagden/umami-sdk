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
