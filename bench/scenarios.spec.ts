import { deepEqual, equal, ok, rejects } from 'node:assert/strict';
import { Transform, Writable } from 'node:stream';
import { describe, it } from 'node:test';

import * as library from '../src/index.ts';

import {
  callbackMicrotask,
  callbackSync,
  CHUNKS,
  createCallbackScenarios,
  createDiscardingSink,
  createPromisifiedScenarios,
  createScenarioName,
  createScenarios,
  createStreamOptions,
  promisedMicrotask,
  promisedSync,
  RATE_LIMIT,
  runPipeline,
  type Lib,
} from './scenarios.ts';

const EXPECTED_VARIANTS = [
  'callback/sync',
  'callback/microtask',
  'callback/sync-rate-limited',
  'promisified/sync',
  'promisified/microtask',
  'promisified/sync-rate-limited',
];

type RecordedCall = {
  factory: 'parallelTransform' | 'promisifiedParallelTransform';
  options: Record<string, unknown>;
};

/** A library whose factories record their options and return a passthrough. */
const createRecordingLib = (calls: RecordedCall[]): Lib => {
  const passthrough = () =>
    new Transform({
      objectMode: true,
      transform: (chunk, _, done) => done(null, chunk),
    });
  return {
    parallelTransform: (options: Record<string, unknown>) => {
      calls.push({ factory: 'parallelTransform', options });
      return passthrough();
    },
    promisifiedParallelTransform: (options: Record<string, unknown>) => {
      calls.push({ factory: 'promisifiedParallelTransform', options });
      return passthrough();
    },
  } as unknown as Lib;
};

describe('Given the benchmark transform functions', () => {
  describe('When callbackSync is called', () => {
    it('should call done synchronously with the doubled chunk', () => {
      const results: unknown[][] = [];
      callbackSync(21, 'utf8', (...args) => results.push(args));
      deepEqual(results, [[null, 42]]);
    });
  });

  describe('When callbackMicrotask is called', () => {
    it('should call done with the doubled chunk only after a microtask', async () => {
      const results: unknown[][] = [];
      callbackMicrotask(21, 'utf8', (...args) => results.push(args));
      deepEqual(results, []);
      await Promise.resolve();
      deepEqual(results, [[null, 42]]);
    });
  });

  describe('When promisedSync is called', () => {
    it('should return the doubled chunk synchronously', () => {
      equal(promisedSync(21), 42);
    });
  });

  describe('When promisedMicrotask is called', () => {
    it('should return a promise of the doubled chunk', async () => {
      const result = promisedMicrotask(21);
      ok(result instanceof Promise);
      equal(await result, 42);
    });
  });
});

describe('Given createDiscardingSink', () => {
  it('should accept objects and emit nothing', async () => {
    const sink = createDiscardingSink();
    ok(sink instanceof Writable);
    equal(sink.writableObjectMode, true);
    const finished = new Promise(resolve => sink.once('finish', resolve));
    sink.write({ any: 'object' });
    sink.end();
    await finished;
  });
});

describe('Given runPipeline', () => {
  describe('When the transform passes every chunk through', () => {
    it('should push every chunk through the transform exactly once', async () => {
      const seen: number[] = [];
      await runPipeline(
        new Transform({
          objectMode: true,
          transform: (chunk: number, _, done) => {
            seen.push(chunk);
            done(null, chunk);
          },
        }),
      );
      equal(seen.length, CHUNKS.length);
      deepEqual(seen, CHUNKS);
    });

    it('should resolve to undefined only after the pipeline has finished', async () => {
      let finished = false;
      const transform = new Transform({
        objectMode: true,
        transform: (chunk, _, done) => done(null, chunk),
        flush: done => {
          finished = true;
          done();
        },
      });
      equal(await runPipeline(transform), undefined);
      ok(finished);
    });
  });

  describe('When the transform fails', () => {
    it('should reject with the transform error', async () => {
      const error = new Error('boom');
      await rejects(
        runPipeline(
          new Transform({
            objectMode: true,
            transform: (_chunk, _, done) => done(error),
          }),
        ),
        error,
      );
    });
  });

  describe('When called twice', () => {
    it('should run a fresh pipeline each time', async () => {
      let count = 0;
      const countingTransform = () =>
        new Transform({
          objectMode: true,
          transform: (chunk, _, done) => {
            count++;
            done(null, chunk);
          },
        });
      await runPipeline(countingTransform());
      await runPipeline(countingTransform());
      equal(count, CHUNKS.length * 2);
    });
  });
});

describe('Given createStreamOptions', () => {
  describe('When rateLimited is false', () => {
    it('should return object mode options without a rateLimit', () => {
      deepEqual(createStreamOptions(true, false), {
        objectMode: true,
        ordered: true,
      });
      ok(!('rateLimit' in createStreamOptions(false, false)));
    });
  });

  describe('When rateLimited is true', () => {
    it('should include the never-reached RATE_LIMIT', () => {
      deepEqual(createStreamOptions(false, true), {
        objectMode: true,
        ordered: false,
        rateLimit: RATE_LIMIT,
      });
    });
  });
});

describe('Given createScenarioName', () => {
  it('should append the ordering mode to the variant', () => {
    equal(createScenarioName('callback/sync', true), 'callback/sync/ordered');
    equal(
      createScenarioName('promisified/microtask', false),
      'promisified/microtask/unordered',
    );
  });
});

describe('Given createCallbackScenarios', () => {
  describe('When ordered is false', () => {
    it('should create the three callback scenarios using parallelTransform', async () => {
      const calls: RecordedCall[] = [];
      const scenarios = createCallbackScenarios(
        createRecordingLib(calls),
        false,
      );
      deepEqual(
        scenarios.map(({ name }) => name),
        [
          'callback/sync/unordered',
          'callback/microtask/unordered',
          'callback/sync-rate-limited/unordered',
        ],
      );
      equal(calls.length, 0, 'transforms are created lazily, per run');
      for (const { fn } of scenarios) {
        await fn();
      }
      deepEqual(
        calls.map(({ factory }) => factory),
        Array(3).fill('parallelTransform'),
      );
      deepEqual(
        calls.map(({ options }) => options.transform),
        [callbackSync, callbackMicrotask, callbackSync],
      );
      deepEqual(
        calls.map(({ options }) => options.ordered),
        [false, false, false],
      );
      deepEqual(
        calls.map(({ options }) => options.rateLimit),
        [undefined, undefined, RATE_LIMIT],
      );
    });
  });

  describe('When ordered is true', () => {
    it('should create ordered scenarios', async () => {
      const calls: RecordedCall[] = [];
      const scenarios = createCallbackScenarios(
        createRecordingLib(calls),
        true,
      );
      ok(scenarios.every(({ name }) => name.endsWith('/ordered')));
      await scenarios[0]!.fn();
      equal(calls[0]!.options.ordered, true);
    });
  });
});

describe('Given createPromisifiedScenarios', () => {
  describe('When ordered is false', () => {
    it('should create the three promisified scenarios using promisifiedParallelTransform', async () => {
      const calls: RecordedCall[] = [];
      const scenarios = createPromisifiedScenarios(
        createRecordingLib(calls),
        false,
      );
      deepEqual(
        scenarios.map(({ name }) => name),
        [
          'promisified/sync/unordered',
          'promisified/microtask/unordered',
          'promisified/sync-rate-limited/unordered',
        ],
      );
      equal(calls.length, 0, 'transforms are created lazily, per run');
      for (const { fn } of scenarios) {
        await fn();
      }
      deepEqual(
        calls.map(({ factory }) => factory),
        Array(3).fill('promisifiedParallelTransform'),
      );
      deepEqual(
        calls.map(({ options }) => options.transform),
        [promisedSync, promisedMicrotask, promisedSync],
      );
      deepEqual(
        calls.map(({ options }) => options.rateLimit),
        [undefined, undefined, RATE_LIMIT],
      );
    });
  });

  describe('When ordered is true', () => {
    it('should create ordered scenarios', async () => {
      const calls: RecordedCall[] = [];
      const scenarios = createPromisifiedScenarios(
        createRecordingLib(calls),
        true,
      );
      ok(scenarios.every(({ name }) => name.endsWith('/ordered')));
      await scenarios[0]!.fn();
      equal(calls[0]!.options.ordered, true);
    });
  });
});

describe('Given createScenarios', () => {
  it('should create every variant in unordered then ordered mode with stable names', () => {
    const names = createScenarios(createRecordingLib([])).map(
      ({ name }) => name,
    );
    deepEqual(names, [
      ...EXPECTED_VARIANTS.map(variant => `${variant}/unordered`),
      ...EXPECTED_VARIANTS.map(variant => `${variant}/ordered`),
    ]);
    equal(new Set(names).size, names.length, 'names are unique');
  });

  it('should create scenarios that each run against the real library', async () => {
    for (const { fn } of createScenarios(library)) {
      await fn();
    }
  });

  it('should create a fresh transform on every run of the same scenario', async () => {
    const calls: RecordedCall[] = [];
    const [scenario] = createScenarios(createRecordingLib(calls));
    await scenario!.fn();
    await scenario!.fn();
    equal(calls.length, 2);
  });
});
