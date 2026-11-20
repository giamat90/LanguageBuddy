import { DEBOUNCE_MS, MAX_WAIT_MS } from './helpers';

/**
 * Decides WHEN an automatic backup runs, never WHAT it does. Pure: time and timers are
 * injectable, so it is tested with a fake clock.
 *
 *  - a burst of changes becomes one run, `debounceMs` after the last change;
 *  - during continuous activity a run still happens at most `maxWaitMs` after the first
 *    unsaved change;
 *  - flush() runs now (the app is going to the background and may be frozen);
 *  - a change that arrives while a run is in progress causes one more run afterwards.
 */

export interface SchedulerDeps {
  /** One backup attempt. It may reject: recording the failure is the caller's job. */
  run: () => Promise<void>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
  debounceMs?: number;
  maxWaitMs?: number;
}

export interface BackupScheduler {
  /** A relevant change happened. */
  notifyChange(): void;
  /** Run now if something is pending (app going to the background). */
  flush(): void;
  /** Forget everything pending (the switch was turned off). */
  cancel(): void;
  isPending(): boolean;
}

export function createBackupScheduler(deps: SchedulerDeps): BackupScheduler {
  const now = deps.now ?? (() => Date.now());
  // Resolve the global timers at call time so fake timers installed later still apply.
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer =
    deps.clearTimer ?? ((id: unknown) => clearTimeout(id as ReturnType<typeof setTimeout>));
  const debounceMs = deps.debounceMs ?? DEBOUNCE_MS;
  const maxWaitMs = deps.maxWaitMs ?? MAX_WAIT_MS;

  let timer: unknown = null;
  let firstChangeAt: number | null = null; // start of the current unsaved window
  let running = false;
  let changedWhileRunning = false;
  let flushWhileRunning = false;

  function disarm() {
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
  }

  function arm() {
    disarm();
    const elapsed = now() - (firstChangeAt as number);
    const wait = Math.max(0, Math.min(debounceMs, maxWaitMs - elapsed));
    timer = setTimer(() => {
      timer = null;
      void execute();
    }, wait);
  }

  async function execute(): Promise<void> {
    if (running) return;
    running = true;
    firstChangeAt = null; // changes from here on belong to the next window
    try {
      await deps.run();
    } catch {
      // the caller records failures; the scheduler must keep working
    } finally {
      running = false;
    }
    if (changedWhileRunning) {
      changedWhileRunning = false;
      const flushNow = flushWhileRunning;
      flushWhileRunning = false;
      firstChangeAt = now();
      if (flushNow) void execute();
      else arm();
    }
  }

  return {
    notifyChange() {
      if (running) {
        changedWhileRunning = true;
        return;
      }
      if (firstChangeAt === null) firstChangeAt = now();
      arm();
    },
    flush() {
      if (running) {
        if (changedWhileRunning) flushWhileRunning = true;
        return;
      }
      if (firstChangeAt === null) return;
      disarm();
      void execute();
    },
    cancel() {
      disarm();
      firstChangeAt = null;
      changedWhileRunning = false;
      flushWhileRunning = false;
    },
    isPending() {
      return firstChangeAt !== null || changedWhileRunning;
    },
  };
}
