"use client";

import { useSyncExternalStore } from "react";
import { formatAbsolute, formatRelative } from "@/lib/time";

function subscribeToTick(callback: () => void) {
  const interval = setInterval(callback, 30_000);
  return () => clearInterval(interval);
}

const getTickClient = () => Date.now();
const getTickServer = () => null;

export function RelativeTime({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  // useSyncExternalStore returns getTickServer's value during SSR + the first
  // client render, then transitions to getTickClient after hydration. That
  // lets us pick a deterministic SSR output (absolute) and swap to relative
  // ("3 minutes ago") post-hydration — without using the setState-in-effect
  // pattern, which the react-hooks/set-state-in-effect rule forbids.
  const tick = useSyncExternalStore(
    subscribeToTick,
    getTickClient,
    getTickServer,
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
      {tick === null ? formatAbsolute(value) : formatRelative(value)}
    </time>
  );
}
