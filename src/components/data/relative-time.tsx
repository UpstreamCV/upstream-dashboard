"use client";

import { useSyncExternalStore } from "react";
import { formatAbsolute, formatRelative } from "@/lib/time";

// One shared 30s ticker for every <RelativeTime /> on the page.
//
// CRITICAL: a useSyncExternalStore `getSnapshot` MUST return a cached, stable
// value — the same reference/primitive until the store actually changes. React
// re-invokes getSnapshot after every commit to check for external changes; a
// snapshot that never compares equal to itself makes React re-render forever
// ("Maximum update depth exceeded"). The earlier implementation used
// `getSnapshot = () => Date.now()`, which returns a fresh value on every call —
// it only avoided an infinite loop by luck, when render+commit happened to land
// inside the same millisecond. Heavier pages (where a render straddles a
// millisecond boundary) tipped it into a hard loop.
//
// The fix: the snapshot is a plain counter that ONLY changes when the interval
// fires. Between ticks getSnapshot returns the identical number, so React sees
// a stable store and doesn't re-render.
let tickCount = 0;
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | null = null;

function subscribeTick(onStoreChange: () => void): () => void {
  tickListeners.add(onStoreChange);
  // Lazily start a single shared interval the first time anything subscribes.
  if (tickTimer === null) {
    tickTimer = setInterval(() => {
      tickCount += 1;
      for (const listener of tickListeners) listener();
    }, 30_000);
  }
  return () => {
    tickListeners.delete(onStoreChange);
    if (tickListeners.size === 0 && tickTimer !== null) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  };
}

// Cached snapshot: returns the same number until the interval ticks.
const getTickSnapshot = (): number => tickCount;
// SSR + the first client (hydration) render use this — a sentinel distinct
// from any real tick, so the server renders the deterministic absolute time
// and the client swaps to relative only after hydration.
const getTickServerSnapshot = (): number => -1;

export function RelativeTime({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  // `-1` during SSR + the first client render; `>= 0` after hydration. The
  // number's only jobs are to flip absolute→relative once after hydration and
  // to re-render every 30s so the relative label stays current.
  const tick = useSyncExternalStore(
    subscribeTick,
    getTickSnapshot,
    getTickServerSnapshot,
  );

  if (!value) {
    return <span className={className}>—</span>;
  }

  return (
    <time
      dateTime={value}
      title={formatAbsolute(value)}
      className={className}
      suppressHydrationWarning
    >
      {tick === -1 ? formatAbsolute(value) : formatRelative(value)}
    </time>
  );
}
