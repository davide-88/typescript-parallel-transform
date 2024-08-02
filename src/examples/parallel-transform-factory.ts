import { hrtime } from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { inspect, parseArgs } from 'node:util';

import { parallelTransform } from '../parallel-transform.factory.js';
import { collect } from '../utils/stream/collect.js';

const args = process.argv.slice(2, process.argv.length);
const {
  values: { ordered },
} = parseArgs({
  args,
  options: {
    ordered: {
      type: 'boolean',
      short: 'o',
      multiple: false,
      default: false,
    },
  },
});

const result: never[] = [];
const start = hrtime.bigint();
await pipeline(
  Readable.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  parallelTransform({
    transform: (chunk, _, done) => {
      setTimeout(() => {
        done(null, chunk);
      }, 1000 / chunk);
    },
    objectMode: true,
    ordered: ordered ?? false,
  }),
  collect(result),
);
const end = hrtime.bigint();

console.log(`Elapsed time: ${Number(end - start) / 1e6}ms`);
console.log(`Result: ${inspect(result, { depth: null })}`);
