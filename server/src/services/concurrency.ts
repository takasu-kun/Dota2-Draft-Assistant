/**
 * Runs `fn` over `items` with at most `concurrency` in flight at once.
 * Used wherever this app needs many independent OpenDota calls (per analyzed
 * match, per candidate hero, ...) without bursting past its free-tier rate
 * limit or waiting on them one at a time.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    results.push(...(await Promise.all(items.slice(i, i + concurrency).map(fn))));
  }
  return results;
}
