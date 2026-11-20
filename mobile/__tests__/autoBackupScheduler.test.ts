import { createBackupScheduler } from '../src/lib/autoBackup/scheduler';

/** A fake clock and timer queue, so time can be moved by hand. */
function harness(run: () => Promise<void>) {
  let t = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const settle = () => new Promise<void>((r) => setImmediate(r));

  const scheduler = createBackupScheduler({
    run,
    now: () => t,
    setTimer: (fn, ms) => {
      const id = ++nextId;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id as number);
    },
  });

  async function advance(ms: number) {
    const target = t + ms;
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > target) break;
      t = next[1].at;
      timers.delete(next[0]);
      next[1].fn();
      await settle();
    }
    t = target;
    await settle();
  }

  return { scheduler, advance, settle, timerCount: () => timers.size };
}

const SEC = 1000;

describe('createBackupScheduler', () => {
  it('turns a burst of changes into one run, 30 s after the last one', async () => {
    const run = jest.fn(async () => {});
    const { scheduler, advance } = harness(run);

    for (let i = 0; i < 5; i++) {
      scheduler.notifyChange();
      await advance(5 * SEC);
    }
    // last change was 5 s ago
    await advance(24 * SEC);
    expect(run).not.toHaveBeenCalled();
    await advance(1 * SEC);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('a later change pushes the run back', async () => {
    const run = jest.fn(async () => {});
    const { scheduler, advance } = harness(run);

    scheduler.notifyChange();
    await advance(29 * SEC);
    scheduler.notifyChange();
    await advance(1 * SEC); // t = 30 s: the first timer would have fired here
    expect(run).not.toHaveBeenCalled();
    await advance(28 * SEC); // t = 58 s
    expect(run).not.toHaveBeenCalled();
    await advance(1 * SEC); // t = 59 s = last change (29 s) + 30 s
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('still runs within 5 min while changes keep arriving', async () => {
    const run = jest.fn(async () => {});
    const { scheduler, advance } = harness(run);

    scheduler.notifyChange(); // t = 0
    for (let t = 20; t < 300; t += 20) {
      await advance(20 * SEC);
      expect(run).not.toHaveBeenCalled();
      scheduler.notifyChange();
    }
    await advance(19 * SEC); // t = 299 s
    expect(run).not.toHaveBeenCalled();
    await advance(1 * SEC); // t = 300 s = first change + maxWait
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('flush() runs a pending backup right away and cancels the timer', async () => {
    const run = jest.fn(async () => {});
    const { scheduler, advance, settle, timerCount } = harness(run);

    scheduler.notifyChange();
    expect(scheduler.isPending()).toBe(true);
    scheduler.flush();
    await settle();
    expect(run).toHaveBeenCalledTimes(1);
    expect(timerCount()).toBe(0);
    expect(scheduler.isPending()).toBe(false);

    await advance(120 * SEC);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('flush() with nothing pending does nothing', async () => {
    const run = jest.fn(async () => {});
    const { scheduler, settle } = harness(run);
    scheduler.flush();
    await settle();
    expect(run).not.toHaveBeenCalled();
  });

  it('a change that arrives during a run causes exactly one more run afterwards', async () => {
    let finish!: () => void;
    const run = jest.fn(
      () => new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { scheduler, advance, settle } = harness(run);

    scheduler.notifyChange();
    await advance(30 * SEC);
    expect(run).toHaveBeenCalledTimes(1); // in progress

    scheduler.notifyChange(); // while running
    scheduler.notifyChange();
    finish();
    await settle();
    expect(run).toHaveBeenCalledTimes(1); // not instantly: it waits like any other change

    await advance(30 * SEC);
    expect(run).toHaveBeenCalledTimes(2);
    finish();
    await settle();
    await advance(120 * SEC);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a flush during a run, with changes waiting, runs again as soon as the first run ends', async () => {
    // The app is going to the background: it may be frozen soon, so do not wait another 30 s.
    let finish!: () => void;
    const run = jest.fn(
      () => new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { scheduler, advance, settle } = harness(run);

    scheduler.notifyChange();
    await advance(30 * SEC);
    expect(run).toHaveBeenCalledTimes(1);

    scheduler.notifyChange(); // changed while running
    scheduler.flush(); // and the app goes to the background
    finish();
    await settle();
    expect(run).toHaveBeenCalledTimes(2); // straight away, no debounce
    finish();
    await settle();
  });

  it('keeps working after a run rejects', async () => {
    const run = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(undefined);
    const { scheduler, advance } = harness(run);

    scheduler.notifyChange();
    await advance(30 * SEC);
    expect(run).toHaveBeenCalledTimes(1);

    scheduler.notifyChange();
    await advance(30 * SEC);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('cancel() drops anything pending', async () => {
    const run = jest.fn(async () => {});
    const { scheduler, advance, timerCount } = harness(run);

    scheduler.notifyChange();
    scheduler.cancel();
    expect(scheduler.isPending()).toBe(false);
    expect(timerCount()).toBe(0);
    await advance(120 * SEC);
    expect(run).not.toHaveBeenCalled();
  });

  it('is not pending before any change and after a completed run', async () => {
    const run = jest.fn(async () => {});
    const { scheduler, advance } = harness(run);
    expect(scheduler.isPending()).toBe(false);
    scheduler.notifyChange();
    expect(scheduler.isPending()).toBe(true);
    await advance(30 * SEC);
    expect(scheduler.isPending()).toBe(false);
  });
});
