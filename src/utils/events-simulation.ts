import type { TestContext } from 'node:test';

import { LinkedListQueue } from '../queue/linked-list-queue.js';
import { Queue } from '../queue/queue.js';

import { chunk } from './array/chunk.js';

export type TimedEventNode = { eventTimeout: number; ticksToNextEvent: number };

export type EventsSimulationOptions = {
  eventsDuration: number[];
  maxConcurrency: number;
};
export const eventsSimulation = {
  computeTicksAndTimeouts: ({
    eventsDuration,
    maxConcurrency,
  }: EventsSimulationOptions): Queue<TimedEventNode> => {
    const queue = new LinkedListQueue<TimedEventNode>();

    //divide eventsDuration into chunks of maxConcurrency
    const chunks = chunk(eventsDuration, maxConcurrency);

    let totalElapsed = 0;
    for (const chunk of chunks) {
      const sortedEventsDuration = [...new Set(chunk)].sort(
        (left, right) => left - right,
      );
      queue.enqueue({
        eventTimeout: totalElapsed,
        ticksToNextEvent: sortedEventsDuration[0],
      });
      let elapsed = sortedEventsDuration[0] ?? 0;
      for (
        let eventIndex = 0;
        eventIndex < sortedEventsDuration.length - 1;
        eventIndex++
      ) {
        const ticks = sortedEventsDuration[eventIndex + 1] - elapsed;
        elapsed += ticks;
        queue.enqueue({
          eventTimeout: totalElapsed + sortedEventsDuration[eventIndex],
          ticksToNextEvent: ticks,
        });
      }
      totalElapsed += elapsed;
    }

    return queue;
  },
  simulate: (
    simulationOptions: EventsSimulationOptions,
    context: TestContext,
  ) => {
    const queue = eventsSimulation.computeTicksAndTimeouts(simulationOptions);
    const first = queue.dequeue();
    if (first === undefined) {
      return;
    }
    process.nextTick(() => context.mock.timers.tick(first.ticksToNextEvent));
    let current = queue.dequeue();
    while (current !== undefined) {
      const ticksToEvent = current.ticksToNextEvent;
      setTimeout(
        () => process.nextTick(() => context.mock.timers.tick(ticksToEvent)),
        current.eventTimeout,
      );
      current = queue.dequeue();
    }
  },
};
