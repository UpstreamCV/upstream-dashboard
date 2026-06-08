"use client";

import { useState } from "react";
import clsx from "clsx";
import { Bell } from "lucide-react";
import { demoAlertRule } from "./fixtures";

// Part 2: the "trigger" set alongside the counting line — a rule that fires the
// part-3 notification. Demo-only, presentational (local state so it's clickable
// on camera). Reads its defaults from demoAlertRule.

type Dir = "in" | "out" | "any";
const DIRS: { key: Dir; label: string }[] = [
  { key: "in", label: "in" },
  { key: "out", label: "out" },
  { key: "any", label: "either way" },
];

export function AlertRuleCard() {
  const [direction, setDirection] = useState<Dir>(demoAlertRule.direction);
  const [enabled, setEnabled] = useState(demoAlertRule.enabled);

  return (
    <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2.5">
          <span
            className="grid place-items-center rounded-full"
            style={{ width: 32, height: 32, background: "rgba(75,129,108,0.16)" }}
          >
            <Bell className="h-4 w-4" style={{ color: "#344c2c" }} />
          </span>
          <span>
            <span className="block font-bold text-[clamp(0.95rem,1.1vw,1.05rem)] text-black">
              Alert rule
            </span>
            <span className="block text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
              trigger on this line
            </span>
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Enable alert rule"
          onClick={() => setEnabled((v) => !v)}
          className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition"
          style={{ background: enabled ? "#4b816c" : "rgba(0,0,0,0.18)" }}
        >
          <span
            className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform"
            style={{ transform: enabled ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
      </div>

      <p
        className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-[clamp(0.9rem,1.1vw,1rem)] text-black"
        style={{ opacity: enabled ? 1 : 0.45 }}
      >
        <span>When a person crosses</span>
        <span className="font-bold">Dock Door</span>
        <span className="inline-flex overflow-hidden rounded-full border border-black/10">
          {DIRS.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={!enabled}
              aria-pressed={direction === d.key}
              onClick={() => setDirection(d.key)}
              className={clsx(
                "px-2.5 py-1 text-sm transition",
                direction === d.key
                  ? "bg-[#4b816c] font-bold text-white"
                  : "bg-white text-[var(--dn-text-50)] hover:bg-black/[0.04]",
              )}
            >
              {d.label}
            </button>
          ))}
        </span>
        <span>→</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(75,129,108,0.14)] px-2.5 py-1 font-bold text-[#344c2c]">
          <Bell className="h-3.5 w-3.5" />
          Notify me
        </span>
      </p>

      <p className="mt-3 text-[clamp(0.8rem,0.95vw,0.9rem)] text-[var(--dn-text-50)]">
        {enabled
          ? "You'll get a notification the moment someone crosses — and an alert if detection looks unreliable."
          : "Rule paused — no notifications will be sent."}
      </p>
    </section>
  );
}
