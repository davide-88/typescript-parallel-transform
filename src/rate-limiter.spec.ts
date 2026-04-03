import { deepEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FixedWindowRateLimiter } from './rate-limiter.js';

describe('Given FixedWindowRateLimiter', () => {
  describe('When acquiring within the rate limit', () => {
    it('should allow up to ratePerSecond calls immediately', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter(3);
      const calls: number[] = [];

      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));
      limiter.acquire(() => calls.push(3));

      deepEqual(calls, [1, 2, 3]);
      limiter.destroy();
    });
  });

  describe('When acquiring beyond the rate limit', () => {
    it('should queue the callback exceeding the rate', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter(2);
      const calls: number[] = [];

      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));
      limiter.acquire(() => calls.push(3));
      limiter.acquire(() => calls.push(4));

      deepEqual(calls, [1, 2]);
      limiter.destroy();
    });

    it('should release queued callbacks on window reset', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter(2);
      const calls: number[] = [];

      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));
      limiter.acquire(() => calls.push(3));
      limiter.acquire(() => calls.push(4));

      deepEqual(calls, [1, 2]);

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3, 4]);
      limiter.destroy();
    });

    it('should release at most ratePerSecond callbacks per window', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter(2);
      const calls: number[] = [];

      for (let i = 1; i <= 6; i++) {
        limiter.acquire(() => calls.push(i));
      }

      deepEqual(calls, [1, 2]);

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3, 4]);

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3, 4, 5, 6]);
      limiter.destroy();
    });
  });

  describe('When destroying the rate limiter', () => {
    it('should clear pending callbacks and stop the timer', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter(1);
      const calls: number[] = [];

      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));

      deepEqual(calls, [1]);

      limiter.destroy();

      context.mock.timers.tick(1000);
      deepEqual(calls, [1]);
    });
  });

  describe('When all pending callbacks are released', () => {
    it('should stop the timer automatically', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter(2);
      const calls: number[] = [];

      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));
      limiter.acquire(() => calls.push(3));

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3]);

      // Window released 1 callback (3), so startsInCurrentWindow=1.
      // Acquiring 4 makes it 2 (at limit), so 5 and 6 are queued.
      limiter.acquire(() => calls.push(4));
      limiter.acquire(() => calls.push(5));
      limiter.acquire(() => calls.push(6));

      deepEqual(calls, [1, 2, 3, 4]);

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3, 4, 5, 6]);
      limiter.destroy();
    });
  });

  describe('When acquiring after a window reset with no pending callbacks', () => {
    it('should allow a full burst in the new window', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter(2);
      const calls: number[] = [];

      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));

      // Tick past the window
      context.mock.timers.tick(1000);

      // New burst in a fresh window
      limiter.acquire(() => calls.push(3));
      limiter.acquire(() => calls.push(4));

      deepEqual(calls, [1, 2, 3, 4]);
      limiter.destroy();
    });
  });
});
