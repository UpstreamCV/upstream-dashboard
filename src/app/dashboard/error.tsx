"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/error";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { area: "dashboard" });
  }, [error]);

  return (
    <div className="glass rounded-3xl px-6 py-10 text-center">
      <AlertTriangle className="w-7 h-7 mx-auto text-[#e89e93]" />
      <h2 className="display text-xl font-semibold mt-3">
        Something <em>broke</em>
      </h2>
      <p className="text-sm text-ink-soft mt-2 max-w-md mx-auto">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest ? (
        <p className="text-[11px] mono text-ink-mute mt-2">
          digest: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-full bg-ink text-base-deep font-medium px-4 py-2 text-sm transition hover:bg-white"
      >
        Try again
      </button>
    </div>
  );
}
