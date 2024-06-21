import { deepEqual, equal } from 'node:assert/strict';
import { Readable, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, it } from 'node:test';

import { ParallelTransform } from './parallel-transform.js';
import { collect } from './utils/stream/collect.js';

class AsyncIdentity {
  private transformCalls: number = 0;
  private forwardTicksIndex: number = 0;
  private readonly sortedTimeouts: number[];
  private timeout: number | undefined = undefined;
  private forwardTicks: number[] = [];
  constructor(private readonly timeouts: number[]) {
    this.sortedTimeouts = [...this.timeouts].sort();
  }

  transform(chunk: never, _: BufferEncoding, done: TransformCallback): void {
    setTimeout(() => done(null, chunk), this.nextTimeout());
  }

  private nextTimeout(): number {
    this.timeout = this.timeouts[this.transformCalls++];
    this.nextForwardTicks();
    return this.timeout;
  }

  private nextForwardTicks(): number[] {
    const timeout = this.timeout;
    const nextForwardTick = this.sortedTimeouts[this.forwardTicksIndex];
    if (!timeout || timeout > nextForwardTick) {
      return [];
    }
    this.forwardTicks = this.sortedTimeouts.slice(
      this.forwardTicksIndex,
      this.transformCalls + 1,
    );
    this.forwardTicksIndex = this.transformCalls + 1;
    return this.forwardTicks;
  }

  getForwardTicks(): number[] {
    return [...this.forwardTicks];
  }
}

describe('Given ParallelTransform', () => {
  describe('When creating a new instance in a synchronous pipeline of objects', () => {
    const testCases = [
      {
        description:
          'When input is an empty array, it should return an empty array',
        input: [],
        transform: (
          chunk: never,
          _: BufferEncoding,
          done: TransformCallback,
        ) => {
          done(null, chunk);
        },
        expected: {
          result: [],
          transform: {
            callCount: 0,
          },
        },
      },
      {
        description:
          'When input is [1] and transform doubles the input entries, it should return a [2]',
        input: [1],
        transform: (
          chunk: number,
          _: BufferEncoding,
          done: TransformCallback,
        ) => {
          done(null, chunk * 2);
        },
        expected: {
          result: [2],
          transform: {
            callCount: 1,
          },
        },
      },
      {
        description:
          'When input is [1,2] and transform doubles the input entries, it should return a [2,4]',
        input: [1, 2],
        transform: (
          chunk: number,
          _: BufferEncoding,
          done: TransformCallback,
        ): void => {
          done(null, chunk * 2);
        },
        expected: {
          result: [2, 4],
          transform: {
            callCount: 2,
          },
        },
      },
    ];

    for (const { input, expected, description, transform } of testCases) {
      it(description, async context => {
        const result: never[] = [];
        const transformMock = context.mock.fn(transform);
        await pipeline(
          Readable.from(input),
          new ParallelTransform({
            objectMode: true,
            transform: transformMock,
          }),
          collect(result),
        );
        deepEqual(result, expected.result);
        equal(transformMock.mock.callCount(), expected.transform.callCount);
      });
    }
  });

  describe('When creating a new instance in an asynchronous pipeline of objects', () => {
    const testCases = [
      {
        description:
          'When input is an empty array, it should return an empty array',
        input: Readable.from([]),
        asyncTransform: new AsyncIdentity([]),
        expected: {
          result: [],
          transform: {
            callCount: 0,
          },
        },
      },
      {
        description:
          'When input is [1] and transform is an async identity that takes 1000ms, ' +
          'it should return [1]',
        input: Readable.from([1]),
        asyncTransform: new AsyncIdentity([1000]),
        expected: {
          result: [1],
          transform: {
            callCount: 1,
          },
        },
      },
      {
        description:
          'When input is [1,2] and transform is an async identity that takes' +
          '1000ms and 1000ms respectively, ' +
          'it should return [1,2]',
        input: Readable.from([1, 2]),
        asyncTransform: new AsyncIdentity([1000, 1000]),
        expected: {
          result: [1, 2],
          transform: {
            callCount: 2,
          },
        },
      },
      {
        description:
          'When input is [1,2] and transform is an async identity that takes ' +
          '1000ms and 100ms respectively, ' +
          'it should return [2,1] (input order is not preserved)',
        input: Readable.from([1, 2]),
        asyncTransform: new AsyncIdentity([1000, 100]),
        expected: {
          result: [2, 1],
          transform: {
            callCount: 2,
          },
        },
      },
      {
        description:
          'When input is [1,2,3] and transform is an async identity that takes ' +
          '100ms, 200ms and 1000ms respectively, ' +
          'it should return [1,2,3] (according to computational order)',
        input: Readable.from([1, 2, 3]),
        asyncTransform: new AsyncIdentity([100, 200, 1000]),
        expected: {
          result: [1, 2, 3],
          transform: {
            callCount: 3,
          },
        },
      },
      {
        description:
          'When input is [1,2,3] and transform is an async identity that takes ' +
          '1000ms, 200ms and 100ms respectively, ' +
          'it should return [3,2,1] (input order is not preserved)',
        input: Readable.from([1, 2, 3]),
        asyncTransform: new AsyncIdentity([1000, 200, 100]),
        expected: {
          result: [3, 2, 1],
          transform: {
            callCount: 3,
          },
        },
      },
      {
        description:
          'When input is [1,2,3] and transform is an async identity that takes ' +
          '200ms, 100ms and 1000ms respectively, ' +
          'it should return [2,1,3] (input order is not preserved)',
        input: Readable.from([1, 2, 3]),
        asyncTransform: new AsyncIdentity([200, 100, 1000]),
        expected: {
          result: [2, 1, 3],
          transform: {
            callCount: 3,
          },
        },
      },
      {
        description:
          'When input is an async generator that never yields, it should return []',
        input: async function* (): AsyncGenerator<number, void> {},
        asyncTransform: new AsyncIdentity([1000]),
        expected: {
          result: [],
          transform: {
            callCount: 0,
          },
        },
      },
      {
        description:
          'When input is an async generator that yields [1] ' +
          'and transform is an async identity that takes 1000ms,' +
          'it should return [1]',
        input: async function* (): AsyncGenerator<number, void> {
          yield 1;
        },
        asyncTransform: new AsyncIdentity([1000]),
        expected: {
          result: [1],
          transform: {
            callCount: 1,
          },
        },
      },
      {
        description:
          'When input is an async generator that yields [1,2] ' +
          'and transform is an async identity that takes 100ms, 1000ms respectively, ' +
          'it should return [1,2]',
        input: async function* (): AsyncGenerator<number, void> {
          for (let i = 1; i <= 2; i++) yield i;
        },
        asyncTransform: new AsyncIdentity([100, 1000]),
        expected: {
          result: [1, 2],
          transform: {
            callCount: 2,
          },
        },
      },
      {
        description:
          'When input is an async generator that yields [1,2] ' +
          'and transform is an async identity that takes 1000ms, 100ms respectively, ' +
          'it should return [2,1]',
        input: async function* (): AsyncGenerator<number, void> {
          for (let i = 1; i <= 2; i++) yield i;
        },
        asyncTransform: new AsyncIdentity([1000, 100]),
        expected: {
          result: [2, 1],
          transform: {
            callCount: 2,
          },
        },
      },
    ];

    for (const { input, asyncTransform, expected, description } of testCases) {
      it(description, async context => {
        const result: never[] = [];
        const transformMock = context.mock.method(asyncTransform, 'transform');
        context.mock.timers.enable({ apis: ['setTimeout'] });
        await pipeline(
          input,
          new ParallelTransform({
            objectMode: true,
            transform: (
              chunk: never,
              bufferEncoding: BufferEncoding,
              done: TransformCallback,
            ) => {
              asyncTransform.transform(chunk, bufferEncoding, done);
              asyncTransform.getForwardTicks().forEach(timeout => {
                process.nextTick(() => context.mock.timers.tick(timeout));
              });
            },
          }),
          collect(result),
        );
        deepEqual(result, expected.result);
        equal(transformMock.mock.callCount(), expected.transform.callCount);
        context.mock.timers.reset();
      });
    }
  });
});
