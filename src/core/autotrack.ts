import type { UmamiInstance } from './types';

export interface AutoTrackHandle {
  stop(): void;
}

const SPA_PAGEVIEW_DELAY = 300;

function handleDataAttributeClick(e: MouseEvent, instance: UmamiInstance): void {
  const target = e.target as Element | null;
  const el = target?.closest('[data-umami-event]');
  if (!el) return;
  const name = el.getAttribute('data-umami-event');
  if (!name) return;
  const data: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    const m = attr.name.match(/^data-umami-event-(.+)$/);
    const key = m?.[1];
    if (key) data[key] = attr.value;
  }
  void instance.track(name, Object.keys(data).length > 0 ? data : undefined);
}

export function setupAutoTrack(
  instance: UmamiInstance,
  options: { dataAttributes?: boolean } = {},
): AutoTrackHandle {
  if (typeof window === 'undefined') return { stop() {} };

  const dataAttributes = options.dataAttributes ?? true;
  let lastUrl = window.location.href;
  const cleanups: Array<() => void> = [];

  const fireInitial = (): void => {
    void instance.track();
  };
  if (document.readyState === 'complete') {
    fireInitial();
  } else {
    const onReady = (): void => {
      if (document.readyState === 'complete') {
        fireInitial();
        document.removeEventListener('readystatechange', onReady, true);
      }
    };
    document.addEventListener('readystatechange', onReady, true);
    cleanups.push(() => document.removeEventListener('readystatechange', onReady, true));
  }

  const handleNav = (): void => {
    const current = window.location.href;
    if (current === lastUrl) return;
    const prev = lastUrl;
    lastUrl = current;
    setTimeout(() => {
      void instance.track((d) => ({ ...d, referrer: prev }));
    }, SPA_PAGEVIEW_DELAY);
  };

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function pushState(this: History, ...args: Parameters<History['pushState']>) {
    originalPush.apply(this, args);
    handleNav();
  };
  history.replaceState = function replaceState(this: History, ...args: Parameters<History['replaceState']>) {
    originalReplace.apply(this, args);
    handleNav();
  };
  window.addEventListener('popstate', handleNav);
  cleanups.push(() => {
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    window.removeEventListener('popstate', handleNav);
  });

  if (dataAttributes) {
    const onClick = (e: MouseEvent): void => handleDataAttributeClick(e, instance);
    document.addEventListener('click', onClick, true);
    cleanups.push(() => document.removeEventListener('click', onClick, true));
  }

  return {
    stop(): void {
      for (const fn of cleanups) fn();
    },
  };
}
