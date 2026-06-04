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
