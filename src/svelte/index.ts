import { readable, type Readable } from 'svelte/store';
import { createUmami, umami } from '../index';
import type { UmamiConfig, UmamiInstance } from '../core/types';

export { createUmami, umami };
export type { UmamiConfig, UmamiInstance };

export interface UmamiStore extends Readable<UmamiInstance> {
  destroy(): void;
}

export function createUmamiStore(config: UmamiConfig): UmamiStore {
  const instance = createUmami(config);
  const { subscribe } = readable(instance);
  return {
    subscribe,
    destroy: () => instance.destroy(),
  };
}
