import { Transform } from 'node:stream';
import type { TransformCallback, TransformOptions } from 'node:stream';

import {
  FixedWindowRateLimiter,
  type RateLimitOptions,
} from './rate-limiter.js';

export type ParallelTransformOptions = TransformOptions & {
  maxConcurrency?: number;
  rateLimit?: RateLimitOptions;
};

/**
 * A parallel transform with concurrency control that allows for
 * concurrent transform operations.
 */
export class ParallelTransform extends Transform {
  protected readonly user: {
    transform: Exclude<TransformOptions['transform'], undefined>;
    flush: Exclude<TransformOptions['flush'], undefined>;
  };
  protected readonly _maxConcurrency: number;
  protected readonly _rateLimiter: FixedWindowRateLimiter | undefined;
  /** Counts chunks accepted into the pipeline (queued or actively processing). */
  protected inflight: number = 0;
  protected readonly callbacks: {
    flush: TransformCallback | undefined;
    transform: TransformCallback | undefined;
  } = {
    flush: undefined,
    transform: undefined,
  };

  constructor(options: ParallelTransformOptions) {
    const {
      transform = (
        chunk: unknown,
        _: BufferEncoding,
        done: TransformCallback,
      ): void => done(null, chunk),
      flush = (done: TransformCallback): void => done(null),
      ...rest
    } = options;
    const { rateLimit, maxConcurrency = 16, ...streamOptions } = rest;
    super(streamOptions);
    this.user = {
      transform,
      flush,
    };
    this._maxConcurrency = maxConcurrency;
    this._rateLimiter = rateLimit
      ? new FixedWindowRateLimiter(rateLimit)
      : undefined;
  }

  get maxConcurrency(): number {
    return this._maxConcurrency;
  }

  get rateLimit(): RateLimitOptions | undefined {
    if (!this._rateLimiter) return undefined;
    return {
      maxPerWindow: this._rateLimiter.maxPerWindow,
      windowMs: this._rateLimiter.windowMs,
    };
  }

  _transform(
    chunk: unknown,
    encoding: BufferEncoding,
    done: TransformCallback,
  ): void {
    this.inflight++;

    const startUserTransform = () => {
      this.user.transform.call(
        this,
        chunk,
        encoding,
        this.onUserTransformComplete(),
      );
    };

    if (this._rateLimiter) {
      this._rateLimiter.acquire(startUserTransform);
    } else {
      startUserTransform();
    }

    if (this.inflight < this._maxConcurrency) {
      done();
    } else {
      this.callbacks.transform = done;
    }
  }

  _destroy(
    error: Error | null,
    callback: (error?: Error | null) => void,
  ): void {
    this._rateLimiter?.destroy();
    super._destroy(error, callback);
  }

  _flush(done: TransformCallback) {
    if (this.inflight > 0) {
      // In case _flush is called before all the transforms are done
      // we need to wait for the rest of the transforms to be completed
      this.callbacks.flush = done;
    } else {
      this.user.flush.call(this, this.onUserFlushComplete(done));
    }
  }

  protected onUserTransformComplete(): TransformCallback {
    return (error?: Error | null, data?: never): void => {
      this.inflight--;
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
      if (this.inflight === 0 && this.callbacks.flush) {
        this.user.flush.call(
          this,
          this.onUserFlushComplete(this.callbacks.flush),
        );
        this.callbacks.flush = undefined;
      }
    };
  }

  protected onUserFlushComplete(done: TransformCallback): TransformCallback {
    return (error?: Error | null): void => {
      if (error) {
        this.emit('error', error);
        return;
      }
      return done();
    };
  }
}
