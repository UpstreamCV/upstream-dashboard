"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setProcessingEnabled } from "@/app/(dash)/(app)/(account)/settings/actions";

// Account-level processing master switch (M3 dashboard surface).
//
// The api-server stores ``accounts.metadata['processing_enabled']`` and the
// processor's eligibility SQL filters on it via a one-line coalesce. So
// turning this off takes effect within ~5s (one processor poll cycle) and
// has the same net GPU impact as physically stopping the supervisor --
// but without the reboot risk of remote-controlling a systemd unit.
//
// Optimistic toggle: flip locally on click, fire the Server Action, roll
// back + toast on failure. Same posture as the geometry editor's save flow.

export function ProcessingToggleNext({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function flip() {
    const next = !enabled;
    setEnabled(next);  // optimistic
    startTransition(async () => {
      const result = await setProcessingEnabled(next);
      if (!result.ok) {
        setEnabled(!next);  // roll back
        toast.error(result.message);
      } else {
        toast.success(
          next
            ? "Processing enabled. Workers will pick up streams within a few seconds."
            : "Processing disabled. No workers will spawn; live streams keep flowing.",
        );
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[clamp(0.95rem,1.1vw,1.05rem)] font-bold text-white">
          Processing
        </p>
        <p className="mt-1 text-[clamp(0.82rem,0.95vw,0.9rem)] text-[var(--dn-text-50)]">
          When on, the processor analyses frames from your cameras while they
          stream. Turn off to keep the live preview running without using GPU
          (the processor service stays online; only workers stop).
        </p>
        <p
          className="mt-2 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]"
          aria-live="polite"
        >
          status: {enabled ? "processing on" : "processing off"}
          {isPending ? " · saving…" : ""}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Toggle processing"
        onClick={flip}
        disabled={isPending}
        className="shrink-0 inline-flex items-center"
      >
        <span
          className="relative inline-block rounded-full transition-colors"
          style={{
            width: "clamp(40px,3.5vw,52px)",
            height: "clamp(22px,2vw,28px)",
            background: enabled ? "#5fb869" : "#9aa39a",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          <span
            className="absolute top-[3px] left-[3px] rounded-full bg-white transition-transform"
            style={{
              width: "calc(clamp(22px,2vw,28px) - 6px)",
              height: "calc(clamp(22px,2vw,28px) - 6px)",
              transform: enabled
                ? "translateX(calc(clamp(40px,3.5vw,52px) - clamp(22px,2vw,28px)))"
                : "translateX(0)",
            }}
          />
        </span>
      </button>
    </div>
  );
}
