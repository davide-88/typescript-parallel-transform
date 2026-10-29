import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { Bench } from 'tinybench';

import { createScenarios, type Lib } from './scenarios.ts';

export type RunResult = {
  node: string;
  results: { name: string; hz: number; meanMs: number; rme: number }[];
};

const {
  values: { lib: libPath, json },
} = parseArgs({
  options: {
    lib: { type: 'string' },
    json: { type: 'string' },
  },
});

if (!libPath) {
  console.error(
    'Usage: node bench/run.ts --lib <path to lib/index.mjs> [--json <out>]',
  );
  process.exit(1);
}

const lib = (await import(pathToFileURL(resolve(libPath)).href)) as Lib;
const bench = new Bench({ time: 1_000, warmupTime: 250 });
for (const { name, fn } of createScenarios(lib)) {
  bench.add(name, fn);
}
await bench.run();

const results = bench.tasks.map(task => {
  const result = task.result;
  if (result?.state !== 'completed') {
    throw new Error(
      `Benchmark ${task.name} did not complete: ${result?.state}`,
    );
  }
  const { latency, throughput } = result;
  return {
    name: task.name,
    hz: throughput.mean,
    meanMs: latency.mean,
    rme: throughput.rme,
  };
});

console.table(
  results.map(({ name, hz, meanMs, rme }) => ({
    name,
    'ops/s': Math.round(hz),
    'mean (ms)': Number(meanMs.toFixed(3)),
    'rme (%)': Number(rme.toFixed(2)),
  })),
);

if (json) {
  const out: RunResult = { node: process.version, results };
  writeFileSync(json, JSON.stringify(out, null, 2));
}
