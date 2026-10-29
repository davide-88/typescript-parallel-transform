import { readFileSync } from 'node:fs';

import type { Comparison } from './compare.ts';

/** A scenario that is more than this much slower is flagged. */
export const REGRESSION_THRESHOLD = 0.1;

const comparisons = process.argv
  .slice(2)
  .map(file => JSON.parse(readFileSync(file, 'utf8')) as Comparison)
  .sort((a, b) => parseInt(a.node.slice(1)) - parseInt(b.node.slice(1)));

if (comparisons.length === 0) {
  console.error('Usage: node bench/report.ts <compare-*.json>...');
  process.exit(1);
}

const majors = comparisons.map(c => `Node ${parseInt(c.node.slice(1))}`);
const names = [
  ...new Set(comparisons.flatMap(c => c.results.map(r => r.name))),
];
const find = (c: Comparison, name: string) =>
  c.results.find(r => r.name === name);
const ops = (hz: number) => Math.round(hz).toLocaleString('en-US');
const percent = (delta: number) =>
  `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}%${delta < -REGRESSION_THRESHOLD ? ' ⚠️' : ''}`;

const lines = [
  '## Benchmark: base vs. this PR',
  '',
  `| Scenario | ${majors.map(m => `${m} base | ${m} PR | ${m} Δ`).join(' | ')} |`,
  `| --- | ${majors.map(() => '---: | ---: | ---:').join(' | ')} |`,
];
for (const name of names) {
  const cells = comparisons.map(c => {
    const r = find(c, name);
    return r
      ? `${ops(r.base)} | ${ops(r.head)} | ${percent(r.delta)}`
      : '- | - | -';
  });
  lines.push(`| \`${name}\` | ${cells.join(' | ')} |`);
}

const all = comparisons.flatMap(c => c.results);
const regressions = all.filter(r => r.delta < -REGRESSION_THRESHOLD);
lines.push(
  '',
  regressions.length
    ? `⚠️ ${regressions.length} of ${all.length} comparisons are more than ${REGRESSION_THRESHOLD * 100}% slower than base (marked ⚠️ above).`
    : `No scenario is more than ${REGRESSION_THRESHOLD * 100}% slower than base.`,
  '',
  `<sub>ops/s = full pipelines of 10,000 chunks per second (median of ${comparisons[0]!.rounds} interleaved rounds per side, built \`lib/\`). Runs: ${comparisons.map(c => c.node).join(', ')}. Shared CI runners are noisy: treat small deltas as noise and rerun to confirm.</sub>`,
);
console.log(lines.join('\n'));
