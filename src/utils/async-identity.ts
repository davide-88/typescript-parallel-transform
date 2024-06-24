import type { TransformCallback } from 'node:stream';

export class AsyncIdentity {
  private transformCalls: number = 0;
  private timeout: number | undefined = undefined;
  constructor(private readonly timeouts: number[]) {}

  transform(chunk: never, _: BufferEncoding, done: TransformCallback): void {
    setTimeout(() => done(null, chunk), this.nextTimeout());
  }

  private nextTimeout(): number {
    this.timeout = this.timeouts[this.transformCalls++];
    return this.timeout;
  }
}
