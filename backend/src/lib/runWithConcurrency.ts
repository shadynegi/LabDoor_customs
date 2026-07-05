/**
 * Run independent async tasks with a concurrency cap (pure helper — no DB imports).
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  if (tasks.length === 0) return [];
  const concurrency = Math.max(1, Math.min(limit, tasks.length));
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex++;
      if (index >= tasks.length) return;
      results[index] = await tasks[index]();
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
