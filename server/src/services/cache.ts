/**
 * Tiny in-memory async cache with TTL + in-flight de-duplication.
 *
 * OpenDota's REST endpoints change slowly (hero stats/patch) and the
 * `/explorer` SQL endpoint is comparatively slow (multi-second queries), so
 * every value we fetch from OpenDota is worth caching for a few minutes
 * instead of re-fetching per request.
 */
export class AsyncCache<K, V> {
  private readonly values = new Map<K, { value: V; expiresAt: number }>();
  private readonly pending = new Map<K, Promise<V>>();

  constructor(private readonly ttlMs: number) {}

  async get(key: K, load: () => Promise<V>): Promise<V> {
    const hit = this.values.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const inFlight = this.pending.get(key);
    if (inFlight) return inFlight;

    const promise = load()
      .then((value) => {
        this.values.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        return value;
      })
      .finally(() => this.pending.delete(key));

    this.pending.set(key, promise);
    return promise;
  }
}
