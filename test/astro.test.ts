import { describe, it, expect } from 'vitest';
import umami, { umami as namedUmami } from '../src/astro/index';

describe('astro integration', () => {
  it('returns an integration named umami-sdk', () => {
    const integration = umami({ websiteId: 'abc', hostUrl: 'https://a.test' });
    expect(integration.name).toBe('umami-sdk');
    expect(typeof integration.hooks['astro:config:setup']).toBe('function');
  });

  it('injects a page script that inits umami with the config', () => {
    const integration = umami({ websiteId: 'abc', hostUrl: 'https://a.test', tag: 'launch' });
    let stage = '';
    let code = '';
    integration.hooks['astro:config:setup']!({
      injectScript: (s, c) => {
        stage = s;
        code = c;
      },
    });
    expect(stage).toBe('page');
    expect(code).toContain("from '@zachlagden/umami-sdk'");
    expect(code).toContain('umami.init(');
    expect(code).toContain('"websiteId":"abc"');
    expect(code).toContain('"hostUrl":"https://a.test"');
    expect(code).toContain('"tag":"launch"');
  });

  it('exposes the same function as a default and named export', () => {
    expect(umami).toBe(namedUmami);
  });
});
