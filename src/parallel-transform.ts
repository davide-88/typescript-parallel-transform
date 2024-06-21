import { Transform } from 'node:stream';
import type { TransformCallback, TransformOptions } from 'node:stream';

export class ParallelTransform extends Transform {
  private user: {
    transform: Exclude<TransformOptions['transform'], undefined>;
    flush: Exclude<TransformOptions['flush'], undefined>;
  };
  private running: number = 0;
  private flushDone: TransformCallback | undefined = undefined;

  constructor({
    transform = (
      chunk: never,
      _: BufferEncoding,
      done: TransformCallback,
    ): void => done(null, chunk),
    flush = (done: TransformCallback): void => done(null),
    ...options
  }: TransformOptions) {
    super(options);
    this.user = {
      transform,
      flush,
    };
  }

  _transform(
    chunk: unknown,
    encoding: BufferEncoding,
    done: TransformCallback,
  ): void {
    this.running++;
    this.user.transform.call(
      this,
      chunk,
      encoding,
      this.onUserTransformComplete.bind(this),
    );
    done();
  }

  _flush(done: TransformCallback) {
    if (this.running > 0) {
      this.user.flush.call(this, this.onUserFlushComplete.bind(this));
      this.flushDone = done;
    } else {
      done();
    }
  }

  private onUserTransformComplete(error?: Error | null, data?: never): void {
    this.running--;
    if (error) {
      this.emit('error', error);
      return;
    }
    this.push(data);
    if (this.running === 0 && this.flushDone) {
      this.flushDone();
    }
  }

  private onUserFlushComplete(error?: Error | null): void {
    if (error) {
      this.emit('error', error);
      return;
    }
  }
}
