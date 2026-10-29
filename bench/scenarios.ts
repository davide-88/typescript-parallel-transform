import { Readable, Writable, type Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type * as Library from '../src/index.ts';

export type Lib = typeof Library;

const CHUNKS = Array.from({ length: 10_000 }, (_, i) => i);

// Never reached, so the rate limiter's bookkeeping is measured, not its waits.
const RATE_LIMIT = { maxPerWindow: 1e9, windowMs: 1_000 };

const sink = (): Writable =>
  new Writable({
    objectMode: true,
    write(_chunk, _encoding, done) {
      done();
    },
  });

const run = (transform: Transform): (() => Promise<void>) => {
  return () => pipeline(Readable.from(CHUNKS), transform, sink());
};

export type Scenario = { name: string; fn: () => Promise<void> };

/** Scenario names are stable: they are the keys used to compare runs. */
export const createScenarios = (lib: Lib): Scenario[] => {
  const { parallelTransform, promisifiedParallelTransform } = lib;
  const scenarios: Scenario[] = [];
  for (const ordered of [false, true]) {
    const mode = ordered ? 'ordered' : 'unordered';
    const base = { objectMode: true, ordered };
    const withRateLimit = { ...base, rateLimit: RATE_LIMIT };

    const callbackSync = (chunk: number, _: BufferEncoding, done: Done) =>
      done(null, chunk * 2);
    const callbackMicrotask = (chunk: number, _: BufferEncoding, done: Done) =>
      queueMicrotask(() => done(null, chunk * 2));
    const promisedSync = (chunk: number) => chunk * 2;
    const promisedMicrotask = async (chunk: number) => chunk * 2;

    const add = (name: string, make: () => Transform) =>
      scenarios.push({ name: `${name}/${mode}`, fn: () => run(make())() });

    add('callback/sync', () =>
      parallelTransform({ ...base, transform: callbackSync }),
    );
    add('callback/microtask', () =>
      parallelTransform({ ...base, transform: callbackMicrotask }),
    );
    add('callback/sync-rate-limited', () =>
      parallelTransform({ ...withRateLimit, transform: callbackSync }),
    );
    add('promisified/sync', () =>
      promisifiedParallelTransform({ ...base, transform: promisedSync }),
    );
    add('promisified/microtask', () =>
      promisifiedParallelTransform({ ...base, transform: promisedMicrotask }),
    );
    add('promisified/sync-rate-limited', () =>
      promisifiedParallelTransform({
        ...withRateLimit,
        transform: promisedSync,
      }),
    );
  }
  return scenarios;
};

type Done = (error?: Error | null, data?: unknown) => void;
