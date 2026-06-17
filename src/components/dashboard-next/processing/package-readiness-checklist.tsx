"use client";

import clsx from "clsx";
import { AlertTriangle, Check, Circle, Clock, Info } from "lucide-react";
import type {
  OverallReadiness,
  ReadinessResult,
  ReadinessStatus,
} from "@/lib/perception/package-readiness";

// P5-I readiness checklist — mirrors the home setup-checklist pattern: derive
// each step from data already on the page, render an overall badge + per-item
// status. Tells the operator exactly what's left before the package is useful.

const OVERALL_BADGE: Record<OverallReadiness, string> = {
  ready: "bg-[var(--dn-green-text)]/15 text-[var(--dn-green-text)]",
  needs_geometry: "bg-[var(--dn-orange-soft)] text-[var(--dn-orange)]",
  needs_save: "bg-[var(--dn-yellow-soft)] text-[var(--dn-yellow)]",
  pending_restart: "bg-[var(--dn-yellow-soft)] text-[var(--dn-yellow)]",
  experimental: "bg-[var(--dn-orange-soft)] text-[var(--dn-orange)]",
  failed_config: "bg-[var(--dn-red-soft)] text-[var(--dn-red)]",
};

function StatusIcon({ status }: { status: ReadinessStatus }) {
  switch (status) {
    case "ok":
      return (
        <Check
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dn-green-text)]"
          aria-label="done"
        />
      );
    case "warn":
      return (
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dn-orange)]"
          aria-label="warning"
        />
      );
    case "todo":
      return (
        <Circle
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dn-yellow)]"
          aria-label="to do"
        />
      );
    case "pending":
      return (
        <Clock
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dn-yellow)]"
          aria-label="pending"
        />
      );
    default:
      return (
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dn-text-50)]"
          aria-label="info"
        />
      );
  }
}

export function PackageReadinessChecklist({
  readiness,
}: {
  readiness: ReadinessResult;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          readiness
        </p>
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
            OVERALL_BADGE[readiness.overall],
          )}
        >
          {readiness.overallLabel}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {readiness.items.map((it) => (
          <li key={it.id} className="flex items-start gap-2 text-sm">
            <StatusIcon status={it.status} />
            <span>
              <span className="text-white/85">{it.label}</span>
              {it.detail ? (
                <span className="text-[var(--dn-text-50)]"> — {it.detail}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
