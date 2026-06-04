// @vitest-environment-options { "url": "https://example.com/" }
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
