import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type { RunResult } from './run.ts';

export type Comparison = {
  node: string;
  rounds: number;
  results: { name: string; base: number; head: number; delta: number }[];
};

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const {
  values: { base, head, rounds = '3', out },
} = parseArgs({
  options: {
    base: { type: 'string' },
    head: { type: 'string' },
    rounds: { type: 'string' },
    out: { type: 'string' },
  },
});

if (!base || !head || !out) {
  console.error(
    'Usage: node bench/compare.ts --base <lib> --head <lib> [--rounds 3] --out <file>',
  );
  process.exit(1);
}

const runnerPath = join(import.meta.dirname, 'run.ts');
const tmp = mkdtempSync(join(tmpdir(), 'bench-'));

const runOnce = (lib: string, file: string): RunResult => {
  execFileSync(
    process.execPath,
    [runnerPath, '--lib', resolve(lib), '--json', file],
    { stdio: ['ignore', 'ignore', 'inherit'] },
  );
  return JSON.parse(readFileSync(file, 'utf8')) as RunResult;
};

// Separate processes, swapping which side goes first every round, so neither side shares JIT state
// and any machine drift affects both sides alike.
const samples = {
  base: new Map<string, number[]>(),
  head: new Map<string, number[]>(),
};
for (let round = 0; round < Number(rounds); round++) {
  for (const side of round % 2
    ? (['head', 'base'] as const)
    : (['base', 'head'] as const)) {
    const { results } = runOnce(
      side === 'base' ? base : head,
      join(tmp, `${side}-${round}.json`),
    );
    for (const { name, hz } of results) {
      samples[side].set(name, [...(samples[side].get(name) ?? []), hz]);
    }
  }
}
rmSync(tmp, { recursive: true, force: true });

const comparison: Comparison = {
  node: process.version,
  rounds: Number(rounds),
  results: [...samples.head.keys()].map(name => {
    const baseHz = median(samples.base.get(name) ?? []);
    const headHz = median(samples.head.get(name) ?? []);
    return { name, base: baseHz, head: headHz, delta: headHz / baseHz - 1 };
  }),
};
writeFileSync(out, JSON.stringify(comparison, null, 2));
console.log(
  `Wrote ${out} (${comparison.results.length} scenarios, Node ${process.version})`,
);
