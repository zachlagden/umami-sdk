import type { App, InjectionKey, Plugin } from 'vue';
import { inject } from 'vue';
import { createUmami } from '../index';
import type { UmamiConfig, UmamiInstance } from '../core/types';

export const umamiInjectionKey: InjectionKey<UmamiInstance> = Symbol('umami');

export const umamiPlugin: Plugin<[UmamiConfig]> = {
  install(app: App, config: UmamiConfig): void {
    const instance = createUmami(config);
    app.provide(umamiInjectionKey, instance);
    const appWithUnmount = app as App & { onUnmount?: (cb: () => void) => void };
    if (typeof appWithUnmount.onUnmount === 'function') {
      appWithUnmount.onUnmount(() => instance.destroy());
    }
  },
};

export function useUmami(): UmamiInstance {
  const instance = inject(umamiInjectionKey);
  if (!instance) {
    throw new Error('useUmami() requires the umami plugin. Call app.use(umamiPlugin, config).');
  }
  return instance;
}
