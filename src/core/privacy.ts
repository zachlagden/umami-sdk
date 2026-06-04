import type { UmamiConfig, Environment } from './types';

const DISABLE_KEY = 'umami.disabled';

export function isDoNotTrackEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = win.doNotTrack ?? nav.doNotTrack ?? nav.msDoNotTrack;
  return dnt === '1' || dnt === 'yes' || (dnt as unknown) === 1;
}

export function isOptedOut(): boolean {
  try {
    return !!window.localStorage.getItem(DISABLE_KEY);
  } catch {
    return false;
  }
}

export function setOptOut(value: boolean): void {
  try {
    if (value) window.localStorage.setItem(DISABLE_KEY, '1');
    else window.localStorage.removeItem(DISABLE_KEY);
  } catch {
    // ignore storage failures
  }
}

export function isBlocked(config: UmamiConfig, env: Environment, serverDisabled: boolean): boolean {
  if (serverDisabled) return true;
  if (!config.websiteId) return true;
  if (isOptedOut()) return true;
  if (config.domains && config.domains.length > 0 && !config.domains.includes(env.hostname)) return true;
  if (config.respectDNT && isDoNotTrackEnabled()) return true;
  return false;
}
