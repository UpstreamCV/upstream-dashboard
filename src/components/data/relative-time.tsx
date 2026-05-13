"use client";

import { useEffect, useState } from "react";
import { formatAbsolute, formatRelative } from "@/lib/time";

export function RelativeTime({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!value) return;
    const interval = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, [value]);

  if (!value) {
    return <span className={className}>—</span>;
  }

  return (
    <time
      dateTime={value}
      title={formatAbsolute(value)}
      className={className}
    >
      {formatRelative(value)}
    </time>
  );
}
