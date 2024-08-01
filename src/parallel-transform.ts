import { Transform } from 'node:stream';
import type { TransformCallback, TransformOptions } from 'node:stream';

export type ParallelTransformOptions = TransformOptions & {
  maxConcurrency?: number;
};

export class ParallelTransform extends Transform {
  private readonly user: {
    transform: Exclude<TransformOptions['transform'], undefined>;
    flush: Exclude<TransformOptions['flush'], undefined>;
  };
  private readonly maxConcurrency: number;
  private running: number = 0;
  private readonly callbacks: {
    flush: TransformCallback | undefined;
    transform: TransformCallback | undefined;
  } = {
    flush: undefined,
    transform: undefined,
  };

  constructor({
    transform = (
      chunk: never,
      _: BufferEncoding,
      done: TransformCallback,
    ): void => done(null, chunk),
    flush = (done: TransformCallback): void => done(null),
    maxConcurrency = 16,
    ...options
  }: ParallelTransformOptions) {
    super(options);
    this.user = {
      transform,
      flush,
    };
    this.maxConcurrency = maxConcurrency;
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
    if (this.running < this.maxConcurrency) {
      done();
    } else {
      this.callbacks.transform = done;
    }
  }

  _flush(done: TransformCallback) {
    if (this.running > 0) {
      // In case _flush is called before all the transforms are done
      // we need to wait for the rest of the transforms to be completed
      this.callbacks.flush = done;
    } else {
      this.user.flush.call(this, this.onUserFlushComplete(done));
    }
  }

  private onUserTransformComplete(error?: Error | null, data?: never): void {
    this.running--;
    if (error) {
      this.emit('error', error);
      return;
    }
    if (this.callbacks.transform) {
      const done = this.callbacks.transform;
      this.callbacks.transform = undefined;
      done(error, data);
    } else {
      // the callback was already called without waiting for
      // the user transform to complete, we need to push the data
      // now that we have it
      this.push(data);
    }
    if (this.running === 0 && this.callbacks.flush) {
      this.user.flush.call(
        this,
        this.onUserFlushComplete(this.callbacks.flush),
      );
      this.callbacks.flush = undefined;
    }
  }

  private onUserFlushComplete(done: TransformCallback): TransformCallback {
    return (error?: Error | null): void => {
      if (error) {
        this.emit('error', error);
      }
      return done();
    };
  }
}
