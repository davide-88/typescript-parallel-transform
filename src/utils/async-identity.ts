import type { TransformCallback } from 'node:stream';

export class AsyncIdentity {
  private transformCalls: number = 0;
  private concurrentCalls: number = 0;
  private maxConcurrentCalls: number = 0;
  private timeout: number | undefined = undefined;
  constructor(private readonly timeouts: number[]) {}

  transform(chunk: never, _: BufferEncoding, done: TransformCallback): void {
    this.concurrentCalls++;
    this.maxConcurrentCalls = Math.max(
      this.concurrentCalls,
      this.maxConcurrentCalls,
    );
    setTimeout(() => {
      this.concurrentCalls--;
      done(null, chunk);
    }, this.nextTimeout());
  }

  getMaxConcurrentCalls(): number {
    return this.maxConcurrentCalls;
  }

  private nextTimeout(): number {
    this.timeout = this.timeouts[this.transformCalls++];
    return this.timeout;
  }
}
