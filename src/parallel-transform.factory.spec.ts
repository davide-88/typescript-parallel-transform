import { deepEqual, ok } from 'node:assert/strict';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { describe, it } from 'node:test';

import {
  OrderedParallelTransform,
  ParallelTransform,
  parallelTransform,
  promisifiedParallelTransform,
} from './index.js';
import { collect } from './utils/stream/collect.js';

describe('Given parallelTransform factory', () => {
  describe('When ordered is false', () => {
    it('should create a ParallelTransform that processes data', async () => {
      const result: number[] = [];
      const transform = parallelTransform({
        objectMode: true,
        ordered: false,
        transform: (chunk: number, _, callback) => callback(null, chunk * 2),
      });
      ok(transform instanceof ParallelTransform);
      await pipeline(Readable.from([1, 2, 3]), transform, collect(result));
      deepEqual(result, [2, 4, 6]);
    });
  });

  describe('When ordered is true', () => {
    it('should create an OrderedParallelTransform that preserves order', async () => {
      const result: number[] = [];
      const transform = parallelTransform({
        objectMode: true,
        ordered: true,
        transform: (chunk: number, _, callback) => callback(null, chunk * 2),
      });
      ok(transform instanceof OrderedParallelTransform);
      await pipeline(Readable.from([1, 2, 3]), transform, collect(result));
      deepEqual(result, [2, 4, 6]);
    });
  });
});

describe('Given promisifiedParallelTransform factory', () => {
  describe('When transform is a sync function that returns a value', () => {
    it('should transform data and push results', async () => {
      const result: number[] = [];
      const transform = promisifiedParallelTransform<number, number>({
        objectMode: true,
        ordered: false,
        transform: (chunk: number) => chunk * 2,
      });
      await pipeline(Readable.from([1, 2, 3]), transform, collect(result));
      deepEqual(result, [2, 4, 6]);
    });
  });

  describe('When transform is an async function that resolves', () => {
    it('should transform data asynchronously and push results', async () => {
      const result: number[] = [];
      const transform = promisifiedParallelTransform<number, number>({
        objectMode: true,
        ordered: false,
        transform: async (chunk: number) => chunk * 2,
      });
      await pipeline(Readable.from([1, 2, 3]), transform, collect(result));
      deepEqual(result, [2, 4, 6]);
    });
  });

  describe('When transform is a sync function that throws', () => {
    it('should propagate the error through the pipeline', async () => {
      const error = new Error('sync-transform-error');
      const transform = promisifiedParallelTransform<number, number>({
        objectMode: true,
        ordered: false,
        transform: () => {
          throw error;
        },
      });
      try {
        await pipeline(Readable.from([1]), transform, collect([]));
        ok(false, 'Expected pipeline to throw');
      } catch (e) {
        deepEqual(e, error);
      }
    });
  });

  describe('When transform is an async function that rejects', () => {
    it('should propagate the rejection through the pipeline', async () => {
      const error = new Error('async-transform-error');
      const transform = promisifiedParallelTransform<number, number>({
        objectMode: true,
        ordered: false,
        transform: async () => {
          throw error;
        },
      });
      try {
        await pipeline(Readable.from([1]), transform, collect([]));
        ok(false, 'Expected pipeline to throw');
      } catch (e) {
        deepEqual(e, error);
      }
    });
  });

  describe('When ordered is true', () => {
    it('should preserve output order', async () => {
      const result: number[] = [];
      const transform = promisifiedParallelTransform<number, number>({
        objectMode: true,
        ordered: true,
        transform: (chunk: number) => chunk * 2,
      });
      ok(transform instanceof OrderedParallelTransform);
      await pipeline(Readable.from([1, 2, 3]), transform, collect(result));
      deepEqual(result, [2, 4, 6]);
    });
  });
});
