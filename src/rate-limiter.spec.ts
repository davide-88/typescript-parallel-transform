import { deepEqual } from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FixedWindowRateLimiter } from './rate-limiter.js';

describe('Given FixedWindowRateLimiter', () => {
  describe('When acquiring within the rate limit', () => {
    it('should allow up to maxPerWindow calls immediately', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 3 });
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
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });
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
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });
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

    it('should release at most maxPerWindow callbacks per window', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });
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
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 1 });
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
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });
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

  describe('When using a custom window duration', () => {
    it('should use the specified windowMs for the interval', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter({
        maxPerWindow: 2,
        windowMs: 5_000,
      });
      const calls: number[] = [];

      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));
      limiter.acquire(() => calls.push(3));

      deepEqual(calls, [1, 2]);

      // Ticking 1000ms should NOT release (window is 5000ms)
      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2]);

      // Ticking to 5000ms total should release
      context.mock.timers.tick(4000);
      deepEqual(calls, [1, 2, 3]);
      limiter.destroy();
    });
  });

  describe('When pending callbacks are queued across multiple windows', () => {
    it('should process all pending callbacks even when they span several windows', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });
      const calls: number[] = [];

      // Fill first window (1, 2) and queue 3-7
      for (let i = 1; i <= 7; i++) {
        limiter.acquire(() => calls.push(i));
      }

      deepEqual(calls, [1, 2]);

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3, 4]);

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3, 4, 5, 6]);

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3, 4, 5, 6, 7]);

      limiter.destroy();
    });

    it('should resume processing new acquires after pending callbacks are drained', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });
      const calls: number[] = [];

      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));
      limiter.acquire(() => calls.push(3));

      // Drain the pending queue
      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3]);

      // Acquire again beyond the limit — new pending callbacks
      // should still be processed on the next window reset.
      // After onWindowReset: startsInCurrentWindow was reset to 0,
      // then callback 3 used 1 slot (startsInCurrentWindow=1).
      // So callback 4 takes the remaining slot, 5 and 6 are queued.
      limiter.acquire(() => calls.push(4));
      limiter.acquire(() => calls.push(5));
      limiter.acquire(() => calls.push(6));

      deepEqual(calls, [1, 2, 3, 4]);

      context.mock.timers.tick(1000);
      deepEqual(calls, [1, 2, 3, 4, 5, 6]);

      limiter.destroy();
    });
  });

  describe('When the timer ref state changes based on pending callbacks', () => {
    let tick: () => void;
    let isRefed: () => boolean;
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;

    beforeEach(() => {
      let callback: () => void;
      let refed = false;
      globalThis.setInterval = ((cb: () => void) => {
        callback = cb;
        refed = true;
        return {
          ref() {
            refed = true;
          },
          unref() {
            refed = false;
          },
          hasRef() {
            return refed;
          },
          [Symbol.dispose]() {},
        } as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval;
      globalThis.clearInterval = (() => {
        refed = false;
      }) as typeof clearInterval;

      tick = () => callback();
      isRefed = () => refed;
    });

    afterEach(() => {
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    });

    it('should not have a ref timer before any acquire', () => {
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });

      deepEqual(
        isRefed(),
        false,
        'Timer should not be refed before any acquire',
      );

      limiter.destroy();
    });

    it('should start the timer as unrefed when no callbacks are pending', () => {
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });

      limiter.acquire(() => {});

      deepEqual(
        isRefed(),
        false,
        'Timer should not be refed when no callbacks are pending',
      );
      limiter.destroy();
    });

    it('should ref the timer when a callback is queued', () => {
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 1 });

      limiter.acquire(() => {});
      deepEqual(
        isRefed(),
        false,
        'Timer should not be refed when no callbacks are pending',
      );

      limiter.acquire(() => {});
      deepEqual(
        isRefed(),
        true,
        'Timer should be refed when a callback is queued',
      );

      limiter.destroy();
    });

    it('should unref the timer after all pending callbacks are drained', () => {
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });

      limiter.acquire(() => {});
      limiter.acquire(() => {});
      limiter.acquire(() => {});

      deepEqual(
        isRefed(),
        true,
        'Timer should be refed when a callback is queued',
      );

      tick();

      deepEqual(
        isRefed(),
        false,
        'Timer should not be refed when all pending callbacks are drained',
      );
      limiter.destroy();
    });
  });

  describe('When window boundaries are preserved after pending drain', () => {
    let tick: () => void;
    let isRefed: () => boolean;
    let timerCleared: boolean;
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;

    beforeEach(() => {
      let callback: () => void;
      let refed = false;
      timerCleared = false;
      globalThis.setInterval = ((cb: () => void) => {
        callback = cb;
        refed = true;
        timerCleared = false;
        return {
          ref() {
            refed = true;
          },
          unref() {
            refed = false;
          },
          hasRef() {
            return refed;
          },
          [Symbol.dispose]() {},
        } as unknown as ReturnType<typeof setInterval>;
      }) as typeof setInterval;
      globalThis.clearInterval = (() => {
        refed = false;
        timerCleared = true;
      }) as typeof clearInterval;

      tick = () => callback();
      isRefed = () => refed;
    });

    afterEach(() => {
      globalThis.setInterval = originalSetInterval;
      globalThis.clearInterval = originalClearInterval;
    });

    it('should keep the timer alive (unrefed) after draining pending callbacks', () => {
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });

      limiter.acquire(() => {});
      limiter.acquire(() => {});
      limiter.acquire(() => {});

      deepEqual(isRefed(), true, 'Timer should be refed with pending');

      // Window reset drains the single pending callback
      tick();

      deepEqual(
        timerCleared,
        false,
        'Timer should NOT be cleared after draining — it stays alive for one more tick',
      );
      deepEqual(
        isRefed(),
        false,
        'Timer should be unrefed after draining so it does not block process exit',
      );

      limiter.destroy();
    });

    it('should clear the timer on the tick AFTER all pending are drained', () => {
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });

      limiter.acquire(() => {});
      limiter.acquire(() => {});
      limiter.acquire(() => {});

      // First tick: drains pending, timer stays alive (unrefed)
      tick();
      deepEqual(timerCleared, false);

      // Second tick: no pending → timer cleared
      tick();
      deepEqual(
        timerCleared,
        true,
        'Timer should be cleared on the next tick when no pending callbacks remain',
      );

      limiter.destroy();
    });

    it('should count new acquires against the current window after drain', () => {
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 3 });
      const calls: number[] = [];

      // Fill window: 3 immediate, 1 pending
      limiter.acquire(() => calls.push(1));
      limiter.acquire(() => calls.push(2));
      limiter.acquire(() => calls.push(3));
      limiter.acquire(() => calls.push(4));

      deepEqual(calls, [1, 2, 3]);

      // Window reset: drains callback 4 (startsInCurrentWindow=1).
      // Timer stays alive (unrefed).
      tick();
      deepEqual(calls, [1, 2, 3, 4]);

      // Acquire 2 more in the SAME window (slots left: 3-1=2).
      // Because the timer was NOT cleared, these count against the
      // current window rather than starting a new one.
      limiter.acquire(() => calls.push(5));
      limiter.acquire(() => calls.push(6));
      deepEqual(calls, [1, 2, 3, 4, 5, 6]);

      // Window is now full (startsInCurrentWindow=3), next acquire is queued
      limiter.acquire(() => calls.push(7));
      deepEqual(
        calls,
        [1, 2, 3, 4, 5, 6],
        'Callback 7 should be queued — window budget exhausted',
      );

      // Next tick releases it
      tick();
      deepEqual(calls, [1, 2, 3, 4, 5, 6, 7]);

      limiter.destroy();
    });

    it('should re-ref the timer when new pending callbacks arrive after drain', () => {
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 1 });

      limiter.acquire(() => {});
      limiter.acquire(() => {});

      deepEqual(isRefed(), true);

      // Drain: timer stays alive, unrefed
      tick();
      deepEqual(isRefed(), false);
      deepEqual(timerCleared, false);

      // New acquire fills the window (startsInCurrentWindow=1 after
      // reset), then another queues → timer re-refed
      limiter.acquire(() => {});
      deepEqual(
        isRefed(),
        true,
        'Timer should be re-refed when new pending callbacks arrive',
      );

      limiter.destroy();
    });
  });

  describe('When acquiring after a window reset with no pending callbacks', () => {
    it('should allow a full burst in the new window', context => {
      context.mock.timers.enable({ apis: ['setInterval'] });
      const limiter = new FixedWindowRateLimiter({ maxPerWindow: 2 });
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
