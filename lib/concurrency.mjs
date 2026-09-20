/** Bounded-concurrency async map: run fn(item) for every item, at most `limit` in flight. */
export async function pool(items, limit, fn) {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++])
  })
  await Promise.all(workers)
}
