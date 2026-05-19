/**
 * Run async tasks with a max concurrency. Returns results in input order.
 * `Promise.allSettled`-style: never throws, individual failures are settled.
 */
export async function mapWithConcurrency<I, O>(
  items: I[],
  concurrency: number,
  fn: (item: I, index: number) => Promise<O>,
): Promise<PromiseSettledResult<O>[]> {
  const results: PromiseSettledResult<O>[] = new Array(items.length);
  let cursor = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      const item = items[i] as I;
      try {
        const value = await fn(item, i);
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}
