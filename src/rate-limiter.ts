import { LinkedListQueue } from './queue/linked-list-queue.js';

export type RateLimitOptions = {
  maxPerWindow: number;
  windowMs?: number;
};

export class FixedWindowRateLimiter {
  private startsInCurrentWindow: number = 0;
  private readonly pendingCallbacks = new LinkedListQueue<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined = undefined;
  readonly maxPerWindow: number;
  readonly windowMs: number;

  constructor({ maxPerWindow, windowMs = 1_000 }: RateLimitOptions) {
    this.maxPerWindow = maxPerWindow;
    this.windowMs = windowMs;
  }

  acquire(onAllowed: () => void): void {
    if (this.startsInCurrentWindow < this.maxPerWindow) {
      this.startsInCurrentWindow++;
      this.ensureTimerRunning();
      onAllowed();
    } else {
      this.pendingCallbacks.enqueue(onAllowed);
      this.ensureTimerRunning();
    }
  }

  destroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.pendingCallbacks.clear();
  }

  private ensureTimerRunning(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      this.onWindowReset();
    }, this.windowMs);
    this.timer.unref();
  }

  private onWindowReset(): void {
    this.startsInCurrentWindow = 0;
    while (
      this.pendingCallbacks.size() > 0 &&
      this.startsInCurrentWindow < this.maxPerWindow
    ) {
      this.startsInCurrentWindow++;
      const cb = this.pendingCallbacks.dequeue()!;
      cb();
    }
    if (this.pendingCallbacks.size() === 0) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
