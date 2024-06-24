import type { TestContext } from 'node:test';

export const simulateEvents = (
  eventsDuration: number[],
  context: TestContext,
) => {
  const sortedEventsDuration = [...new Set(eventsDuration)].sort(
    (left, right) => left - right,
  );
  let elapsed = sortedEventsDuration[0] ?? 0;
  for (
    let eventIndex = 0;
    eventIndex < sortedEventsDuration.length - 1;
    eventIndex++
  ) {
    const eventDuration = sortedEventsDuration[eventIndex];
    const ticks = sortedEventsDuration[eventIndex + 1] - elapsed;
    elapsed += ticks;
    setTimeout(
      () => process.nextTick(() => context.mock.timers.tick(ticks)),
      eventDuration,
    );
  }
  const min = sortedEventsDuration[0] ?? 0;
  if (min > 0) {
    process.nextTick(() => context.mock.timers.tick(min));
  }
};
