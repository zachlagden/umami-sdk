import type { UmamiConfig } from '../core/types';

type InjectStage = 'before-hydration' | 'head-inline' | 'page' | 'page-ssr';

export interface AstroIntegrationLike {
  name: string;
  hooks: {
    'astro:config:setup'?: (options: {
      injectScript: (stage: InjectStage, content: string) => void;
    }) => void;
  };
}

/**
 * Astro integration that injects Umami tracking into every page.
 *
 * Note: `beforeSend` is not supported here (it cannot be serialized into the
 * injected script). Use the core SDK directly if you need it.
 */
export default function umami(config: UmamiConfig): AstroIntegrationLike {
  const serialized = JSON.stringify(config);
  return {
    name: 'umami-sdk',
    hooks: {
      'astro:config:setup': ({ injectScript }) => {
        injectScript('page', `import { umami } from '@zachlagden/umami-sdk';umami.init(${serialized});`);
      },
    },
  };
}

export { umami };
