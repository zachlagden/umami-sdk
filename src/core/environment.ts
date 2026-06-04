import type { Environment } from './types';

export function getBrowserEnvironment(): Environment {
  const { screen, navigator, location, document } = window;
  return {
    hostname: location.hostname,
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language,
    title: document.title,
    url: location.href,
    referrer: document.referrer,
  };
}
