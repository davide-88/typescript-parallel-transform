import type { TransformCallback } from 'node:stream';

export class AsyncIdentity<T> {
  #transformCalls: number = 0;
  #concurrentCalls: number = 0;
  #maxConcurrentCalls: number = 0;
  #timeout: number | undefined = undefined;
  readonly #timeouts: number[];
  constructor(timeouts: number[]) {
    this.#timeouts = timeouts;
  }

  transform(chunk: T, _: BufferEncoding, done: TransformCallback): void {
    this.#concurrentCalls++;
    this.#maxConcurrentCalls = Math.max(
      this.#concurrentCalls,
      this.#maxConcurrentCalls,
    );
    setTimeout(() => {
      this.#concurrentCalls--;
      done(null, chunk);
    }, this.#nextTimeout());
  }

  getMaxConcurrentCalls(): number {
    return this.#maxConcurrentCalls;
  }

  #nextTimeout(): number {
    this.#timeout = this.#timeouts[this.#transformCalls++];
    return this.#timeout;
  }
}
