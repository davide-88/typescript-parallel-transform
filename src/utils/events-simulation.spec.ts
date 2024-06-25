import { deepEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eventsSimulation, TimedEventNode } from './events-simulation.js';

describe('Given eventsSimulation', () => {
  describe('When computing ticks and timeouts', () => {
    const testCases = [
      {
        description:
          'When input is an empty array, it should return an empty array',
        input: {
          eventsDuration: [],
          maxConcurrency: 1,
        },
        expected: [],
      },
      {
        description:
          'When input events duration is [1], ' +
          'it should return [{eventTimeout: 0, ticksToNextEvent: 1 }]',
        input: {
          eventsDuration: [1],
          maxConcurrency: 1,
        },
        expected: [
          {
            eventTimeout: 0,
            ticksToNextEvent: 1,
          },
        ] satisfies TimedEventNode[],
      },
      {
        description:
          'When input events duration is [1,2] and ' +
          'max concurrency is 1, ' +
          'it should return [' +
          '{eventTimeout: 0, ticksToNextEvent: 1 }, ' +
          '{eventTimeout: 1, ticksToNextEvent: 2 }]',
        input: {
          eventsDuration: [1, 2],
          maxConcurrency: 1,
        },
        expected: [
          {
            eventTimeout: 0,
            ticksToNextEvent: 1,
          },
          {
            eventTimeout: 1,
            ticksToNextEvent: 2,
          },
        ] satisfies TimedEventNode[],
      },
      {
        description:
          'When input events duration is [1,2] and ' +
          'max concurrency is 2, ' +
          'it should return [' +
          '{eventTimeout: 0, ticksToNextEvent: 1 }, ' +
          '{eventTimeout: 1, ticksToNextEvent: 1 }]',
        input: {
          eventsDuration: [1, 2],
          maxConcurrency: 2,
        },
        expected: [
          {
            eventTimeout: 0,
            ticksToNextEvent: 1,
          },
          {
            eventTimeout: 1,
            ticksToNextEvent: 1,
          },
        ] satisfies TimedEventNode[],
      },
      {
        description:
          'When input events duration is [1,1] and ' +
          'max concurrency is 1, ' +
          'it should return [' +
          '{eventTimeout: 0, ticksToNextEvent: 1 }, ' +
          '{eventTimeout: 1, ticksToNextEvent: 1 }]',
        input: {
          eventsDuration: [1, 1],
          maxConcurrency: 2,
        },
        expected: [
          {
            eventTimeout: 0,
            ticksToNextEvent: 1,
          },
        ] satisfies TimedEventNode[],
      },
      {
        description:
          'When input events duration is [1,1] and ' +
          'max concurrency is 1, ' +
          'it should return [' +
          '{eventTimeout: 0, ticksToNextEvent: 1 }, ' +
          '{eventTimeout: 1, ticksToNextEvent: 1 }]',
        input: {
          eventsDuration: [1, 1],
          maxConcurrency: 1,
        },
        expected: [
          {
            eventTimeout: 0,
            ticksToNextEvent: 1,
          },
          {
            eventTimeout: 1,
            ticksToNextEvent: 1,
          },
        ] satisfies TimedEventNode[],
      },
      {
        description:
          'When input events duration is [2,1] and ' +
          'max concurrency is 2, ' +
          'it should return [' +
          '{eventTimeout: 0, ticksToNextEvent: 1 }, ' +
          '{eventTimeout: 1, ticksToNextEvent: 1 }]',
        input: {
          eventsDuration: [1, 1],
          maxConcurrency: 1,
        },
        expected: [
          {
            eventTimeout: 0,
            ticksToNextEvent: 1,
          },
          {
            eventTimeout: 1,
            ticksToNextEvent: 1,
          },
        ] satisfies TimedEventNode[],
      },
      {
        description:
          'When input events duration is [2,1] and ' +
          'max concurrency is 1, ' +
          'it should return [' +
          '{eventTimeout: 0, ticksToNextEvent: 2 }, ' +
          '{eventTimeout: 2, ticksToNextEvent: 1 }]',
        input: {
          eventsDuration: [2, 1],
          maxConcurrency: 1,
        },
        expected: [
          {
            eventTimeout: 0,
            ticksToNextEvent: 2,
          },
          {
            eventTimeout: 2,
            ticksToNextEvent: 1,
          },
        ] satisfies TimedEventNode[],
      },
    ];
    testCases.forEach(({ input, expected, description }) => {
      it(description, () => {
        const result = eventsSimulation.computeTicksAndTimeouts(input);
        deepEqual(result.toArray(), expected);
      });
    });
  });
});
