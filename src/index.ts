import { createUmami, type UmamiDeps } from './core/instance';
import { EventQueue } from './core/queue';
import type { UmamiConfig, UmamiInstance, EventPayload } from './core/types';

export { createUmami };
export type { UmamiConfig, UmamiInstance, EventPayload, BeforeSend, SendType } from './core/types';

let instance: UmamiInstance | null = null;
let queue = new EventQueue();

function enqueue(call: (i: UmamiInstance) => Promise<void>): Promise<void> {
  if (instance) return call(instance);
  return new Promise<void>((resolve) => {
    queue.add(() => {
      void call(instance as UmamiInstance).then(resolve);
    });
  });
}

export const umami = {
  init(config: UmamiConfig, deps?: UmamiDeps): UmamiInstance {
    instance = createUmami(config, deps);
    queue.flush();
    return instance;
  },
  track(
    ...args:
      | []
      | [string, Record<string, unknown>?]
      | [Partial<EventPayload>]
      | [(d: EventPayload) => Partial<EventPayload>]
  ): Promise<void> {
    return enqueue((i) => (i.track as (...a: unknown[]) => Promise<void>)(...args));
  },
  identify(
    ...args: [string, Record<string, unknown>?] | [Record<string, unknown>]
  ): Promise<void> {
    return enqueue((i) => (i.identify as (...a: unknown[]) => Promise<void>)(...args));
  },
  enable(): void {
    instance?.enable();
  },
  disable(): void {
    instance?.disable();
  },
  get disabled(): boolean {
    return instance ? instance.disabled : false;
  },
  reset(): void {
    instance?.destroy();
    instance = null;
    queue = new EventQueue();
  },
};
