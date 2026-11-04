// src/controller/heartbeat.ts
//
// The step heartbeat throttle (design C3). Turns stream lines into at most
// one write per window. No file access, no knowledge of runs: the caller's
// `write` carries the value wherever it belongs.

export const HEARTBEAT_WINDOW_MS = 10_000;

export interface StepHeartbeat {
  line(): void;
  end(): void;
}

export function createStepHeartbeat(opts: {
  now(): Date;
  write(value: string | undefined): Promise<unknown>;
  windowMs?: number;
}): StepHeartbeat {
  const { now, write } = opts;
  const windowMs = opts.windowMs ?? HEARTBEAT_WINDOW_MS;

  let ended = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: string | undefined;

  const run = (value: string | undefined) => {
    write(value).catch((err) => {
      console.error('[heartbeat] write failed', err);
    });
  };

  const openWindow = () => {
    timer = setTimeout(() => {
      timer = undefined;
      if (pending !== undefined) {
        const value = pending;
        pending = undefined;
        run(value);
        openWindow();
      }
    }, windowMs);
    timer.unref?.();
  };

  return {
    line() {
      if (ended) return;
      if (timer === undefined) {
        run(now().toISOString());
        openWindow();
      } else {
        pending = now().toISOString();
      }
    },
    end() {
      if (ended) return;
      ended = true;
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
      pending = undefined;
      run(undefined);
    },
  };
}
