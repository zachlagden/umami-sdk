import { createComponent, createContext, onCleanup, useContext, type JSX } from 'solid-js';
import { createUmami } from '../index';
import type { UmamiConfig, UmamiInstance } from '../core/types';

const UmamiContext = createContext<UmamiInstance>();

export interface UmamiProviderProps {
  config: UmamiConfig;
  children: JSX.Element;
}

export function UmamiProvider(props: UmamiProviderProps): JSX.Element {
  const instance = createUmami(props.config);
  onCleanup(() => instance.destroy());
  return createComponent(UmamiContext.Provider, {
    value: instance,
    get children() {
      return props.children;
    },
  });
}

export function useUmami(): UmamiInstance {
  const instance = useContext(UmamiContext);
  if (!instance) {
    throw new Error('useUmami() must be used within a <UmamiProvider>.');
  }
  return instance;
}
