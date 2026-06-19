"use client";

import clsx from "clsx";

// P5-L — Advanced | Guided segmented toggle for the Processing tab. Mirrors the
// reliability RangeToggle pattern (aria-pressed pills). Advanced is the default.

export type SetupMode = "advanced" | "guided";

const MODES: { id: SetupMode; label: string; hint: string }[] = [
  { id: "advanced", label: "Advanced", hint: "Pick a model + tracker, compare stats" },
  { id: "guided", label: "Guided", hint: "Tell us what the camera should do" },
];

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: SetupMode;
  onChange: (mode: SetupMode) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="group" aria-label="Setup mode" className="inline-flex gap-1">
        {MODES.map((m) => {
          const active = m.id === mode;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(m.id)}
              className={clsx(
                "rounded-full border px-3 py-1.5 text-sm font-bold transition",
                active
                  ? "border-[var(--dn-creek-mid)]/40 bg-[var(--dn-creek-mid)] text-white"
                  : "border-white/10 bg-white/[0.06] text-[var(--dn-text-50)] hover:bg-white/[0.08] hover:text-white",
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <span className="text-xs text-[var(--dn-text-50)]">
        {MODES.find((m) => m.id === mode)?.hint}
      </span>
    </div>
  );
}
