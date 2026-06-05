import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { createUmami } from '../index';
import type { UmamiConfig, UmamiInstance } from '../core/types';

export type UmamiAnalyticsProps = Omit<UmamiConfig, 'autoTrack'>;

function UmamiAnalyticsInner(props: UmamiAnalyticsProps): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams ? searchParams.toString() : '';
  const instanceRef = useRef<UmamiInstance | null>(null);
  const configRef = useRef(props);
  configRef.current = props;

  useEffect(() => {
    const inst = createUmami({ ...configRef.current, autoTrack: false });
    instanceRef.current = inst;
    return () => {
      inst.destroy();
      instanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    instanceRef.current?.track();
  }, [pathname, search]);

  return null;
}

export function UmamiAnalytics(props: UmamiAnalyticsProps) {
  return (
    <Suspense fallback={null}>
      <UmamiAnalyticsInner {...props} />
    </Suspense>
  );
}
