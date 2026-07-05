import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from '../../../../backend/src/lib/runWithConcurrency';

describe('runWithConcurrency', () => {
  it('runs all tasks and preserves result order', async () => {
    const results = await runWithConcurrency(
      [0, 1, 2, 3, 4].map((n) => async () => n * 2),
      2
    );
    expect(results).toEqual([0, 2, 4, 6, 8]);
  });

  it('limits simultaneous in-flight tasks', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await runWithConcurrency(
      Array.from({ length: 6 }, () => async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
        return true;
      }),
      2
    );

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});
