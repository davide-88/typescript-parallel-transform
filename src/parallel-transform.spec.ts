import { deepEqual, equal, ok } from 'node:assert/strict';
import { Readable, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, it } from 'node:test';

import { ParallelTransform } from './parallel-transform.js';
import { AsyncIdentity } from './utils/async-identity.js';
import { eventsSimulation } from './utils/events-simulation.js';
import { collect } from './utils/stream/collect.js';

describe('Given ParallelTransform with rateLimit', () => {
  it('should limit the number of transform calls per window', async context => {
    context.mock.timers.enable({ apis: ['setInterval'] });
    const callTimestamps: number[] = [];
    let currentTime = 0;
    const result: number[] = [];

    const pipelinePromise = pipeline(
      Readable.from([1, 2, 3, 4]),
      new ParallelTransform({
        objectMode: true,
        rateLimit: { maxPerWindow: 2 },
        transform: (
          chunk: number,
          _: BufferEncoding,
          done: TransformCallback,
        ) => {
          callTimestamps.push(currentTime);
          done(null, chunk);
        },
      }),
      collect(result),
    );

    // First 2 should fire immediately (window 0)
    await new Promise(r => process.nextTick(r));
    equal(callTimestamps.length, 2);

    // Tick the interval to release the next window
    currentTime = 1000;
    context.mock.timers.tick(1000);
    await new Promise(r => process.nextTick(r));

    await pipelinePromise;
    deepEqual(callTimestamps, [0, 0, 1000, 1000]);
    deepEqual(result, [1, 2, 3, 4]);
  });

  it('should apply both maxConcurrency and rateLimit together', async context => {
    context.mock.timers.enable({ apis: ['setInterval'] });
    const callTimestamps: number[] = [];
    let currentTime = 0;
    const result: number[] = [];

    const pipelinePromise = pipeline(
      Readable.from([1, 2, 3, 4, 5, 6]),
      new ParallelTransform({
        objectMode: true,
        maxConcurrency: 3,
        rateLimit: { maxPerWindow: 2 },
        transform: (
          chunk: number,
          _: BufferEncoding,
          done: TransformCallback,
        ) => {
          callTimestamps.push(currentTime);
          done(null, chunk);
        },
      }),
      collect(result),
    );

    // rateLimit.max=2 limits to 2 per window despite maxConcurrency=3
    await new Promise(r => process.nextTick(r));
    equal(callTimestamps.length, 2);

    currentTime = 1000;
    context.mock.timers.tick(1000);
    await new Promise(r => process.nextTick(r));

    currentTime = 2000;
    context.mock.timers.tick(1000);
    await new Promise(r => process.nextTick(r));

    await pipelinePromise;
    deepEqual(callTimestamps, [0, 0, 1000, 1000, 2000, 2000]);
    deepEqual(result.sort(), [1, 2, 3, 4, 5, 6]);
  });
});

describe('Given ParallelTransform', () => {
  it('should initiate the user transform before signaling readiness for the next chunk', async () => {
    const order: string[] = [];
    const result: number[] = [];

    class InstrumentedParallelTransform extends ParallelTransform {
      override _transform(
        chunk: unknown,
        encoding: BufferEncoding,
        done: TransformCallback,
      ): void {
        super._transform(
          chunk,
          encoding,
          (...args: Parameters<TransformCallback>) => {
            order.push(`done-${chunk}`);
            done(...args);
          },
        );
      }
    }

    await pipeline(
      Readable.from([1]),
      new InstrumentedParallelTransform({
        objectMode: true,
        maxConcurrency: 16,
        transform: (
          chunk: number,
          _: BufferEncoding,
          done: TransformCallback,
        ) => {
          order.push(`transform-${chunk}`);
          done(null, chunk);
        },
      }),
      collect(result),
    );

    deepEqual(order, ['transform-1', 'done-1']);
    deepEqual(result, [1]);
  });

  describe('When creating a new instance in a synchronous pipeline of objects', () => {
    describe('When no error occurs in the transform or flush function', () => {
      const testCases = [
        {
          description:
            'When input is an empty array, it should return an empty array',
          input: [],
          transform: (
            chunk: number,
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
          const flushMock = context.mock.fn((done: TransformCallback) =>
            done(),
          );
          await pipeline(
            Readable.from(input),
            new ParallelTransform({
              objectMode: true,
              transform: transformMock,
              flush: flushMock,
            }),
            collect(result),
          );
          deepEqual(result, expected.result);
          equal(transformMock.mock.callCount(), expected.transform.callCount);
          equal(flushMock.mock.callCount(), 1);
        });
      }
    });

    it('When no transform is provided, it should use the default passthrough transform', async () => {
      const result: unknown[] = [];
      await pipeline(
        Readable.from([1, 2, 3]),
        new ParallelTransform({ objectMode: true }),
        collect(result),
      );
      deepEqual(result, [1, 2, 3]);
    });

    describe('When an error occurs in the transform or flush function', () => {
      const testCases = [
        {
          description:
            'When input is an empty array, it should return an empty array since the transform function is never called',
          input: [],
          transform: (
            chunk: number,
            _: BufferEncoding,
            done: TransformCallback,
          ) => {
            done(new Error('some-error'), chunk);
          },
          flush: (done: TransformCallback) => {
            done();
          },
          expected: {
            result: [],
            transform: {
              callCount: 0,
            },
            error: undefined,
          },
        },
        {
          description:
            'When input is [1] and the transform function passes an error to the callback, it should throw the same error',
          input: [1],
          transform: (
            chunk: number,
            _: BufferEncoding,
            done: TransformCallback,
          ) => {
            done(new Error('some-error'), chunk);
          },
          flush: (done: TransformCallback) => {
            done();
          },
          expected: {
            result: ['does-not-matter-since-transform-throws'],
            transform: {
              callCount: 1,
            },
            error: new Error('some-error'),
          },
        },
        {
          description:
            'When input is [1] and the flush function passes an error to the callback, it should throw the same error',
          input: [1],
          transform: (
            chunk: number,
            _: BufferEncoding,
            done: TransformCallback,
          ) => {
            done(null, chunk);
          },
          flush: (done: TransformCallback) => {
            done(new Error('some-error'));
          },
          expected: {
            result: ['does-not-matter-since-transform-throws'],
            transform: {
              callCount: 1,
            },
            error: new Error('some-error'),
          },
        },
      ];

      for (const {
        input,
        expected,
        description,
        transform,
        flush,
      } of testCases) {
        it(description, async context => {
          const result: never[] = [];
          const transformMock = context.mock.fn(transform);
          const flushMock = context.mock.fn(flush);
          try {
            await pipeline(
              Readable.from(input),
              new ParallelTransform({
                objectMode: true,
                transform: transformMock,
                flush: flushMock,
              }),
              collect(result),
            );
            deepEqual(result, expected.result);
            equal(transformMock.mock.callCount(), expected.transform.callCount);
            equal(flushMock.mock.callCount(), 1);
          } catch (error) {
            deepEqual(error, expected.error);
          }
        });
      }
    });
  });

  describe('When creating a new instance in an asynchronous pipeline of objects', () => {
    const testCases = [
      {
        description:
          'When input is an empty array, it should return an empty array',
        input: Readable.from([]),
        eventsDuration: [],
        maxConcurrency: 16,
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
        eventsDuration: [1000],
        maxConcurrency: 16,
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
        eventsDuration: [1000, 1000],
        maxConcurrency: 16,
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
        eventsDuration: [1000, 100],
        maxConcurrency: 16,
        expected: {
          result: [2, 1],
          transform: {
            callCount: 2,
          },
        },
      },
      {
        description:
          'When input is [1,2] and transform is an async identity that takes ' +
          '1000ms and 100ms respectively and concurrency is capped to 1, ' +
          'it should return [1,2] (order is preserved since max concurrency is 1)',
        input: Readable.from([1, 2]),
        eventsDuration: [1000, 100],
        maxConcurrency: 1,
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
          '100ms and 1000ms respectively and concurrency is capped to 1, ' +
          'it should return [1,2] (order is preserved since max concurrency is 1)',
        input: Readable.from([1, 2]),
        eventsDuration: [100, 1000],
        maxConcurrency: 1,
        expected: {
          result: [1, 2],
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
        eventsDuration: [100, 200, 1000],
        maxConcurrency: 16,
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
        eventsDuration: [1000, 200, 100],
        maxConcurrency: 16,
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
          '1000ms, 200ms and 100ms respectively and concurrency is capped to 1, ' +
          'it should return [1,2,3] (order is preserved since max concurrency is 1)',
        input: Readable.from([1, 2, 3]),
        eventsDuration: [1000, 200, 100],
        maxConcurrency: 1,
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
          '1000ms, 200ms and 100ms respectively and concurrency is capped to 2, ' +
          'it should return [2,3,1] (order is not preserved since max concurrency is 2. ' +
          'The first chunk takes more than the second + the third ones. Thus they complete first.)',
        input: Readable.from([1, 2, 3]),
        eventsDuration: [1000, 200, 100],
        maxConcurrency: 2,
        expected: {
          result: [2, 3, 1],
          transform: {
            callCount: 3,
          },
        },
      },
      {
        description:
          'When input is [1,2,3] and transform is an async identity that takes ' +
          '1000ms, 800ms and 300ms respectively and concurrency is capped to 2, ' +
          'it should return [2,1,3] (order is not preserved since max concurrency is 2. ' +
          'The first chunk takes more than the second but less than the second + the third ones.)',
        input: Readable.from([1, 2, 3]),
        eventsDuration: [1000, 800, 300],
        maxConcurrency: 2,
        expected: {
          result: [2, 1, 3],
          transform: {
            callCount: 3,
          },
        },
      },
      {
        description:
          'When input is [1,2,3] and transform is an async identity that takes ' +
          '1000ms, 800ms and 300ms respectively and concurrency is capped to 3, ' +
          'it should return [3,2,1] (order is not preserved since max concurrency is 3)',
        input: Readable.from([1, 2, 3]),
        eventsDuration: [1000, 800, 300],
        maxConcurrency: 3,
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
        eventsDuration: [200, 100, 1000],
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
        eventsDuration: [],
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
        eventsDuration: [1000],
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
        eventsDuration: [100, 1000],
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
        eventsDuration: [1000, 100],
        expected: {
          result: [2, 1],
          transform: {
            callCount: 2,
          },
        },
      },
    ];

    for (const {
      input,
      expected,
      description,
      eventsDuration,
      maxConcurrency = 16,
    } of testCases) {
      it(description, async context => {
        const result: never[] = [];
        const asyncTransform = new AsyncIdentity(eventsDuration);
        const transformMock = context.mock.method(asyncTransform, 'transform');
        const flushMock = context.mock.fn((done: TransformCallback) => done());
        context.mock.timers.enable({ apis: ['setTimeout'] });
        const pipelinePromise = pipeline(
          input,
          new ParallelTransform({
            objectMode: true,
            maxConcurrency,
            transform: (
              chunk: number,
              bufferEncoding: BufferEncoding,
              done: TransformCallback,
            ) => {
              asyncTransform.transform(chunk, bufferEncoding, done);
            },
            flush: flushMock,
          }),
          collect(result),
        );
        eventsSimulation.simulate({ eventsDuration, maxConcurrency }, context);
        await pipelinePromise;
        deepEqual(result, expected.result);
        equal(transformMock.mock.callCount(), expected.transform.callCount);
        equal(flushMock.mock.callCount(), 1);
        ok(
          asyncTransform.getMaxConcurrentCalls() <= maxConcurrency,
          `measured max concurrency ${asyncTransform.getMaxConcurrentCalls()} when ${
            maxConcurrency
          } was expected`,
        );
        context.mock.timers.reset();
      });
    }
  });
});
