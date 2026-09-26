const inFlight = new Map<string, Promise<unknown>>();

/**
 * Joins an identical request that's already running instead of starting another. Server actions
 * run one at a time, so duplicates (e.g. effects re-running) would otherwise queue back to back.
 */
export function shareRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const running = inFlight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const request = load().finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}
