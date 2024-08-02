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

/**
 * A parallel transform stream that pushes resolved data
 * in the order the corresponding chunks they originate
 * from were received.
 */
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
      const pushedDataCount = this.pushResolvedDataOrdered();
      // The delayed transform callback has to be called only if the data was pushed.
      // Otherwise the transform concurrency would be capped to the max concurrency
      // but the size of the queue would exceed the max concurrency.
      if (this.callbacks.transform && pushedDataCount > 0) {
        const done = this.callbacks.transform;
        this.callbacks.transform = undefined;
        done();
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
   * It pushes only resolved data in the order the corresponding chunks they originate from were received.
   * @private
   * @returns The number of pushed data.
   */
  private pushResolvedDataOrdered(): number {
    let pushedDataCount = 0;
    let current = this.resultsQueue.peek();
    while (current?.resolved === true) {
      this.resultsQueue.dequeue();
      this.push(current.data);
      pushedDataCount++;
      current = this.resultsQueue.peek();
    }
    return pushedDataCount;
  }
}
