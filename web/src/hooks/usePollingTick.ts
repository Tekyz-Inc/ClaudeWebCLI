import { useEffect, useState } from "react";

/**
 * Shared polling tick — a single module-level timer drives all polling hooks.
 *
 * Why: we previously had multiple hooks each running their own setInterval,
 * which caused redundant work and subtle race conditions on rapid tab switches.
 * This unified tick emits a monotonically-increasing counter every TICK_MS.
 * Hooks that need a slower cadence simply skip ticks (e.g. every other tick
 * for a 10s cadence on a 5s base tick).
 *
 * Subscribers receive the current tick count via useState, so they re-render
 * on each tick and can trigger their own fetch effect.
 */

const TICK_MS = 5000;

type Listener = (tick: number) => void;
const listeners = new Set<Listener>();
let interval: ReturnType<typeof setInterval> | null = null;
let tickCount = 0;

function ensureInterval(): void {
  if (interval !== null) return;
  interval = setInterval(() => {
    tickCount++;
    for (const fn of listeners) fn(tickCount);
  }, TICK_MS);
}

function stopIntervalIfIdle(): void {
  if (interval !== null && listeners.size === 0) {
    clearInterval(interval);
    interval = null;
  }
}

/**
 * Subscribe to the shared polling tick. Returns the current tick number,
 * which increments every `TICK_MS`. Components re-render on each tick.
 */
export function usePollingTick(): number {
  const [tick, setTick] = useState(tickCount);
  useEffect(() => {
    const listener: Listener = (t) => setTick(t);
    listeners.add(listener);
    ensureInterval();
    return () => {
      listeners.delete(listener);
      stopIntervalIfIdle();
    };
  }, []);
  return tick;
}

/** Test/debug hook — returns the current module-level tick counter. */
export function __getTickCount(): number {
  return tickCount;
}
