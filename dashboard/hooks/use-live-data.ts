// dashboard/hooks/use-live-data.ts
import { useState, useEffect } from 'react';

/**
 * A hook to abstract polling/realtime fetching logic.
 * Currently uses simple HTTP polling but can easily be swapped 
 * to WebSockets or SSE in the future without changing the UI components.
 */
export function useLiveData<T>(
  fetcher: () => Promise<T>,
  intervalMs = 5000,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let timer: NodeJS.Timeout;

    const tick = async () => {
      try {
        const result = await fetcher();
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          timer = setTimeout(tick, intervalMs);
        }
      }
    };

    tick();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [fetcher, intervalMs, enabled]);

  return { data, error, loading };
}
