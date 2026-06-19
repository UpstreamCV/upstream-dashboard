"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { ProcessingPackage, ProcessingPackageStatus } from "@/lib/api/types";
import type { RecommendationTier } from "@/lib/perception/package-recommendation";

// One catalog package, rendered as an expandable card. The status badge is
// driven by the package's `status` field (never hardcoded per id) so an
// experimental package always reads as experimental. Server-authored
// `warnings` are surfaced on the card itself, not buried in the detail.

const STATUS_BADGE: Record<
  ProcessingPackageStatus,
  { label: string; cls: string }
> = {
  supported: {
    label: "Production-ready",
    cls: "bg-[var(--dn-green-text)]/15 text-[var(--dn-green-text)]",
  },
  probe: {
    label: "Probe",
    cls: "bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-mid)]",
  },
  experimental: {
    label: "Experimental",
    cls: "bg-[var(--dn-orange-soft)] text-[var(--dn-orange)]",
  },
  deprecated: {
    label: "Deprecated",
    cls: "bg-[var(--dn-red-soft)] text-[var(--dn-red)]",
  },
};

// Recommendation tier badge (shown only when a use case is selected).
const RECOMMENDATION_BADGE: Record<RecommendationTier, string> = {
  recommended: "bg-[var(--dn-green-text)]/15 text-[var(--dn-green-text)]",
  compatible: "bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-mid)]",
  experimental: "bg-[var(--dn-orange-soft)] text-[var(--dn-orange)]",
  not_recommended: "bg-white/5 text-[var(--dn-text-50)]",
};

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
      {children}
    </span>
  );
}

export function PackageCard({
  pkg,
  selected,
  isRequested,
  onSelect,
  recommendation,
  children,
}: {
  pkg: ProcessingPackage;
  selected: boolean;
  isRequested: boolean;
  onSelect: () => void;
  recommendation?: { tier: RecommendationTier; label: string };
  children?: ReactNode;
}) {
  const badge = STATUS_BADGE[pkg.status];

  return (
    <div
      className={clsx(
        "dn-tile p-[clamp(1rem,1.6vw,1.4rem)] transition",
        selected
          ? "border border-[var(--dn-creek-mid)]/50"
          : "border border-transparent",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-expanded={selected}
        className="flex w-full items-start gap-3 text-left"
      >
        {selected ? (
          <ChevronDown
            className="mt-1 h-4 w-4 shrink-0 text-[var(--dn-creek-mid)]"
            aria-hidden
          />
        ) : (
          <ChevronRight
            className="mt-1 h-4 w-4 shrink-0 text-[var(--dn-text-50)]"
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-[clamp(1rem,1.4vw,1.15rem)] text-white">
              {pkg.display_name}
            </h3>
            {recommendation ? (
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                  RECOMMENDATION_BADGE[recommendation.tier],
                )}
              >
                {recommendation.label}
              </span>
            ) : null}
            <span
              className={clsx(
                "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider",
                badge.cls,
              )}
            >
              {badge.label}
            </span>
            {!pkg.first_party ? (
              <span
                className="rounded-full bg-[var(--dn-yellow-soft)] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--dn-yellow)]"
                title="Bring your own license — not an Upstream-provided package"
              >
                BYOM
              </span>
            ) : null}
            {!pkg.production_ready ? (
              <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
                not production-ready
              </span>
            ) : null}
            {isRequested ? (
              <span className="rounded-full bg-[var(--dn-creek-mid)]/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--dn-creek-mid)]">
                requested
              </span>
            ) : null}
          </div>
          {pkg.description ? (
            <p className="mt-1 text-sm text-[var(--dn-text-50)]">
              {pkg.description}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pkg.requires_geometry ? <Chip>needs geometry</Chip> : null}
            {pkg.requires_restart ? <Chip>applies next session</Chip> : null}
            {pkg.compute_tier ? <Chip>{pkg.compute_tier} compute</Chip> : null}
            {pkg.best_for.slice(0, 3).map((b) => (
              <Chip key={b}>{b.replace(/_/g, " ")}</Chip>
            ))}
          </div>
          {pkg.warnings.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {pkg.warnings.map((w, i) => (
                <li
                  key={i}
                  className="rounded-md border border-[var(--dn-orange)]/30 bg-[var(--dn-orange-soft)] px-2.5 py-1.5 text-xs text-[var(--dn-orange)]"
                >
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </button>
      {selected ? (
        <div className="mt-3 border-t border-white/10 pt-3">{children}</div>
      ) : null}
    </div>
  );
}
