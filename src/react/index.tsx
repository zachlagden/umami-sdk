import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createUmami } from '../index';
import type { UmamiConfig, UmamiInstance } from '../core/types';

const noopInstance: UmamiInstance = {
  track: (..._args: unknown[]) => Promise.resolve(),
  identify: (..._args: unknown[]) => Promise.resolve(),
  enable: () => {},
  disable: () => {},
  disabled: false,
  destroy: () => {},
} as unknown as UmamiInstance;

const UmamiContext = createContext<UmamiInstance | undefined>(undefined);

export interface UmamiProviderProps {
  config: UmamiConfig;
  children: ReactNode;
}

export function UmamiProvider({ config, children }: UmamiProviderProps) {
  const [instance, setInstance] = useState<UmamiInstance | null>(null);

  useEffect(() => {
    const inst = createUmami(config);
    setInstance(inst);
    return () => inst.destroy();
  }, []);

  return (
    <UmamiContext.Provider value={instance ?? noopInstance}>{children}</UmamiContext.Provider>
  );
}

export function useUmami(): UmamiInstance {
  const ctx = useContext(UmamiContext);
  if (ctx === undefined) {
    throw new Error('useUmami must be used within a <UmamiProvider>.');
  }
  return ctx;
}
