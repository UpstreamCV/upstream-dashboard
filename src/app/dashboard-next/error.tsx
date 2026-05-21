"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { reportError } from "@/lib/error";

// Segment-scoped error boundary. area: "dashboard-next" keeps new-dashboard
// failures distinguishable from the live dashboard in error reporting.
// Repainted to the scoped light theme (no prod .glass/text-ink).
export default function DashboardNextError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { area: "dashboard-next" });
  }, [error]);

  return (
    <div className="dn-shell-bg min-h-dvh grid place-items-center p-6">
      <div className="dn-tile w-full max-w-md text-center p-8">
        <AlertTriangle className="w-7 h-7 mx-auto" style={{ color: "#e15a4c" }} />
        <h2 className="text-xl font-bold mt-3">Something broke</h2>
        <p className="text-sm mt-2 text-[var(--dn-text-50)]">
          {error.message || "An unexpected error occurred."}
        </p>
        {error.digest ? (
          <p className="text-[11px] mt-2 text-[var(--dn-text-50)]">
            digest: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="dn-grad-btn mt-5 px-5 py-2 text-sm font-bold"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
