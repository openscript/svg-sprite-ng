/**
 * Run the given task factories with a bounded number of concurrently running tasks.
 * Results are returned in task order; the first rejection rejects the whole run.
 */
export async function runPool<T>(
  tasks: readonly (() => Promise<T> | T)[],
  limit: number
): Promise<T[]> {
  const results = Array.from<T>({ length: tasks.length });
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const index = next++;
      const task = tasks[index];

      if (task) {
        results[index] = await task();
      }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, worker));

  return results;
}

/**
 * Small promise based work queue with a concurrency limit. Tasks are started as soon as they are added;
 * `idle()` resolves once everything that has been added so far has settled.
 */
export class TaskQueue {
  readonly #limit: number;
  readonly #waiting: (() => void)[] = [];
  readonly #settled: Promise<unknown>[] = [];
  #active = 0;
  #errors: unknown[] = [];

  constructor(limit: number) {
    this.#limit = Math.max(1, limit);
  }

  get active(): number {
    return this.#active + this.#waiting.length;
  }

  add(task: () => Promise<void> | void): void {
    const run = async (): Promise<void> => {
      if (this.#active >= this.#limit) {
        await new Promise<void>((resolve) => {
          this.#waiting.push(resolve);
        });
      }

      this.#active++;

      try {
        await task();
      } catch (error) {
        this.#errors.push(error);
      } finally {
        this.#active--;
        this.#waiting.shift()?.();
      }
    };

    this.#settled.push(run());
  }

  /** Wait until all queued tasks are done; rejects with the first error that occurred. */
  async idle(): Promise<void> {
    while (this.#settled.length > 0) {
      const pending = this.#settled.splice(0);
      await Promise.all(pending);
    }

    const [error] = this.#errors;
    if (this.#errors.length > 0) {
      this.#errors = [];
      throw error;
    }
  }
}
