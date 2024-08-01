import { hrtime } from 'node:process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { inspect } from 'node:util';

import { ParallelTransform } from './../parallel-transform.js';
import { collect } from './../utils/stream/collect.js';

const result: never[] = [];
const start = hrtime.bigint();
await pipeline(
  Readable.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
  new ParallelTransform({
    transform: (chunk, _, done) => {
      setTimeout(() => {
        done(null, chunk);
      }, 1000 / chunk);
    },
    objectMode: true,
  }),
  collect(result),
);
const end = hrtime.bigint();

console.log(`Elapsed time: ${Number(end - start) / 1e6}ms`);
console.log(`Result: ${inspect(result, { depth: null })}`);
