export class FixedWindowRateLimiter {
  private startsInCurrentWindow: number = 0;
  private readonly pendingCallbacks: (() => void)[] = [];
  private timer: ReturnType<typeof setInterval> | undefined = undefined;

  constructor(readonly ratePerSecond: number) {}

  acquire(onAllowed: () => void): void {
    if (this.startsInCurrentWindow < this.ratePerSecond) {
      this.startsInCurrentWindow++;
      this.ensureTimerRunning();
      onAllowed();
    } else {
      this.pendingCallbacks.push(onAllowed);
      this.ensureTimerRunning();
    }
  }

  destroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.pendingCallbacks.length = 0;
  }

  private ensureTimerRunning(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      this.onWindowReset();
    }, 1_000);
    this.timer.unref();
  }

  private onWindowReset(): void {
    this.startsInCurrentWindow = 0;
    while (
      this.pendingCallbacks.length > 0 &&
      this.startsInCurrentWindow < this.ratePerSecond
    ) {
      this.startsInCurrentWindow++;
      const cb = this.pendingCallbacks.shift()!;
      cb();
    }
    if (this.pendingCallbacks.length === 0) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
