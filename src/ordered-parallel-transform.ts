import type { TransformCallback } from 'node:stream';

import {
  ParallelTransform,
  ParallelTransformOptions,
} from './parallel-transform.js';
import { LinkedListQueue } from './queue/linked-list-queue.js';

type ResultContainer = {
  data?: never;
  resolved: boolean;
};
export const resultContainerFactory = {
  create: (): ResultContainer => {
    return {
      resolved: false,
    };
  },
};

export class OrderedParallelTransform extends ParallelTransform {
  private resultsQueue = new LinkedListQueue<ResultContainer>();
  constructor(options: ParallelTransformOptions) {
    super(options);
  }

  protected onUserTransformComplete(): TransformCallback {
    const resultContainer = resultContainerFactory.create();
    this.resultsQueue.enqueue(resultContainer);
    return (error?: Error | null, data?: never): void => {
      this.running--;
      if (error) {
        this.emit('error', error);
        return;
      }
      resultContainer.data = data;
      resultContainer.resolved = true;
      if (this.callbacks.transform) {
        const done = this.callbacks.transform;
        this.callbacks.transform = undefined;
        this.pushResolvedDataOrdered();
        done();
      } else {
        // the callback was already called without waiting for
        // the user transform to complete, we need to push the data
        // in order if resolved in the proper order
        this.pushResolvedDataOrdered();
      }
      if (this.running === 0 && this.callbacks.flush) {
        this.user.flush.call(
          this,
          this.onUserFlushComplete(this.callbacks.flush),
        );
        this.callbacks.flush = undefined;
      }
    };
  }

  /**
   * It pushes the resolved data in order to the stream
   * @private
   */
  private pushResolvedDataOrdered() {
    for (const result of this.resultsQueue) {
      if (!result.resolved) {
        break;
      }
      this.push(this.resultsQueue.dequeue()?.data);
    }
  }
}
