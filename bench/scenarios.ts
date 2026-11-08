import {
  Readable,
  Writable,
  type Transform,
  type TransformCallback,
} from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type * as Library from '../src/index.ts';

export type Lib = typeof Library;

export type Scenario = { name: string; fn: () => Promise<void> };

export const CHUNKS = Array.from({ length: 10_000 }, (_, i) => i);

// Never reached, so the rate limiter's bookkeeping is measured, not its waits.
export const RATE_LIMIT = { maxPerWindow: 1e9, windowMs: 1_000 };

export const callbackSync = (
  chunk: number,
  _: BufferEncoding,
  done: TransformCallback,
): void => done(null, chunk * 2);

export const callbackMicrotask = (
  chunk: number,
  _: BufferEncoding,
  done: TransformCallback,
): void => queueMicrotask(() => done(null, chunk * 2));

export const promisedSync = (chunk: number): number => chunk * 2;

export const promisedMicrotask = async (chunk: number): Promise<number> =>
  chunk * 2;

/** A destination that discards its input, so only the transform is measured. */
export const createDiscardingSink = (): Writable =>
  new Writable({
    objectMode: true,
    write(_chunk, _encoding, done) {
      done();
    },
  });

/** Streams every chunk of `CHUNKS` through `transform` into a discarding sink. */
export const runPipeline = (transform: Transform): Promise<void> =>
  pipeline(Readable.from(CHUNKS), transform, createDiscardingSink());

export const createStreamOptions = (
  ordered: boolean,
  rateLimited: boolean,
) => ({
  objectMode: true,
  ordered,
  ...(rateLimited && { rateLimit: RATE_LIMIT }),
});

/** Scenario names are stable: they are the keys used to compare runs. */
export const createScenarioName = (variant: string, ordered: boolean): string =>
  `${variant}/${ordered ? 'ordered' : 'unordered'}`;

const createScenario = (
  variant: string,
  ordered: boolean,
  createTransform: () => Transform,
): Scenario => ({
  name: createScenarioName(variant, ordered),
  fn: () => runPipeline(createTransform()),
});

export const createCallbackScenarios = (
  { parallelTransform }: Lib,
  ordered: boolean,
): Scenario[] => {
  const plain = createStreamOptions(ordered, false);
  const rateLimited = createStreamOptions(ordered, true);
  return [
    createScenario('callback/sync', ordered, () =>
      parallelTransform({ ...plain, transform: callbackSync }),
    ),
    createScenario('callback/microtask', ordered, () =>
      parallelTransform({ ...plain, transform: callbackMicrotask }),
    ),
    createScenario('callback/sync-rate-limited', ordered, () =>
      parallelTransform({ ...rateLimited, transform: callbackSync }),
    ),
  ];
};

export const createPromisifiedScenarios = (
  { promisifiedParallelTransform }: Lib,
  ordered: boolean,
): Scenario[] => {
  const plain = createStreamOptions(ordered, false);
  const rateLimited = createStreamOptions(ordered, true);
  return [
    createScenario('promisified/sync', ordered, () =>
      promisifiedParallelTransform({ ...plain, transform: promisedSync }),
    ),
    createScenario('promisified/microtask', ordered, () =>
      promisifiedParallelTransform({ ...plain, transform: promisedMicrotask }),
    ),
    createScenario('promisified/sync-rate-limited', ordered, () =>
      promisifiedParallelTransform({
        ...rateLimited,
        transform: promisedSync,
      }),
    ),
  ];
};

export const createScenarios = (lib: Lib): Scenario[] =>
  [false, true].flatMap(ordered => [
    ...createCallbackScenarios(lib, ordered),
    ...createPromisifiedScenarios(lib, ordered),
  ]);
