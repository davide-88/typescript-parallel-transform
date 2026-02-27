import { equal } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LinkedListQueue } from './linked-list-queue.js';

describe('Given LinkedListQueue', () => {
  const testCases = [
    {
      description:
        'When input is an empty array, dequeue should return undefined',
      input: [],
      expected: {
        size: 0,
      },
    },
    {
      description: 'When input is [1], dequeue should return 1',
      input: [1],
      expected: {
        size: 1,
      },
    },
    {
      description: 'When input is [1,2], dequeue should return 1, 2',
      input: [1, 2],
      expected: {
        size: 2,
      },
    },
  ];

  testCases.forEach(({ input, expected, description }) => {
    it(description, () => {
      const queue = new LinkedListQueue<never>();
      input.forEach(value => queue.enqueue(value as never));
      equal(queue.size(), expected.size);
      for (let i = 0; i < input.length; i++) {
        equal(queue.dequeue(), input[i]);
      }
      equal(queue.dequeue(), undefined);
    });
  });

  it('When constructed with initial values, it should contain those values in order', () => {
    const queue = new LinkedListQueue([1, 2, 3]);
    equal(queue.size(), 3);
    equal(queue.dequeue(), 1);
    equal(queue.dequeue(), 2);
    equal(queue.dequeue(), 3);
    equal(queue.dequeue(), undefined);
  });
});
