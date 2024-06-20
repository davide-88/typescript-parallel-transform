import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { cwd, hrtime, stdout } from 'node:process';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { run } from 'node:test';
import { inspect, parseArgs } from 'node:util';
import fastGlobAsync from 'fast-glob';
import { spec as Spec } from 'node:test/reporters';

const configTestStream = ({ files, watch, timeout, concurrency }) => {
  const testStream = run({
    files,
    timeout,
    concurrency,
    watch,
  });

  testStream.on('test:fail', data => {
    console.error(inspect(data, { depth: null }));
  });
  return testStream;
};

/**
 * @typedef {Object} Logger
 * @property {function} info
 * @property {function} error
 * @property {function} warn
 * @property {function} debug
 */
/**
 * @typedef {Object} TestConfig
 * @property {string} [tests] Glob pattern for test files.
 * @property {boolean} [watch] Watch mode.
 * @property {boolean} [silent] Silent mode.
 * @property {Logger} [logger] Logger.
 * @property {number} [timeout] Timeout for each test.
 * @property {number} [concurrency] Number of concurrent tests.
 */
/**
 * Run all tests with the given configuration.
 * @param config {TestConfig} Configuration object.
 * @return {Promise<void>}
 */
const runAllTests = async config => {
  const start = hrtime.bigint();
  const files = await fastGlobAsync(config.tests, {
    absolute: true,
    onlyFiles: true,
  });
  config.logger.info(
    `Time to list files: ${Number(hrtime.bigint() - start) / 1e6}ms`,
  );

  const testStream = configTestStream({
    files,
    watch: config.watch,
    concurrency: config.concurrency,
    timeout: config.timeout,
  });

  await pipeline(
    testStream,
    new Spec(),
    config.silent ? new PassThrough() : stdout,
  );
};

const parseConfig = () => {
  const args = process.argv.slice(2, process.argv.length);
  const { values: config } = parseArgs({
    args,
    options: {
      tests: {
        type: 'string',
        short: 't',
        multiple: false,
        default: join(cwd(), 'src', '**', '*.spec.ts'),
      },
      watch: {
        type: 'boolean',
        short: 'w',
        multiple: false,
        default: false,
      },
      silent: {
        type: 'boolean',
        short: 's',
        multiple: false,
        default: false,
      },
      timeout: {
        type: 'string',
        short: 'T',
        multiple: false,
        default: '60000',
      },
      concurrency: {
        type: 'string',
        short: 'c',
        multiple: false,
        default: `${availableParallelism()}`,
      },
    },
  });
  return config;
};

try {
  const config = parseConfig();
  await runAllTests({
    tests: config.tests,
    watch: config.watch,
    silent: config.silent,
    timeout: Number(config.timeout),
    concurrency: Number(config.concurrency),
    logger: {
      info: console.info,
      error: console.error,
      warn: console.warn,
      debug: console.debug,
    },
  });
} catch (e) {
  console.error(
    `An error occurred: ${e.message}: `,
    inspect(e, { depth: null }),
  );
  process.exit(1);
}
