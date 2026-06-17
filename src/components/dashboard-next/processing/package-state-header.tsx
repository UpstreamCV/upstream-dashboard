"use client";

import type { ReactNode } from "react";
import clsx from "clsx";
import { Send } from "lucide-react";
import type {
  CameraPackageConfigResponse,
  CameraPackageState,
  ProcessingPackageCatalogResponse,
} from "@/lib/api/types";

// Top-of-tab summary: requested vs applied package + the derived lifecycle
// state badge + server-authored warnings, plus the Apply action. Honest copy —
// apply takes effect on the camera's NEXT session; never implies a live restart.

const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50";

const STATE_BADGE: Record<CameraPackageState, { label: string; cls: string }> = {
  unset: { label: "No package", cls: "bg-white/5 text-[var(--dn-text-50)]" },
  active: {
    label: "Active",
    cls: "bg-[var(--dn-green-text)]/15 text-[var(--dn-green-text)]",
  },
  pending_apply: {
    label: "Pending",
    cls: "bg-[var(--dn-yellow-soft)] text-[var(--dn-yellow)]",
  },
  pending_restart: {
    label: "Pending restart",
    cls: "bg-[var(--dn-yellow-soft)] text-[var(--dn-yellow)]",
  },
  failed_config: {
    label: "Failed",
    cls: "bg-[var(--dn-red-soft)] text-[var(--dn-red)]",
  },
  experimental_selected: {
    label: "Experimental active",
    cls: "bg-[var(--dn-orange-soft)] text-[var(--dn-orange)]",
  },
};

function Banner({
  tone,
  children,
}: {
  tone: "info" | "warn" | "error";
  children: ReactNode;
}) {
  const cls =
    tone === "error"
      ? "border-[var(--dn-red)]/30 bg-[var(--dn-red-soft)] text-[var(--dn-red)]"
      : tone === "warn"
        ? "border-[var(--dn-orange)]/30 bg-[var(--dn-orange-soft)] text-[var(--dn-orange)]"
        : "border-white/10 bg-white/[0.04] text-[var(--dn-text-50)]";
  return (
    <p
      className={clsx("mt-3 rounded-lg border p-2.5 text-xs", cls)}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)] self-center">
        {label}
      </dt>
      <dd className="text-sm text-white/80">{value}</dd>
    </>
  );
}

export function PackageStateHeader({
  config,
  catalog,
  onApply,
  applying,
}: {
  config: CameraPackageConfigResponse;
  catalog: ProcessingPackageCatalogResponse;
  onApply: () => void;
  applying: boolean;
}) {
  const nameFor = (id: string | null | undefined): string | null => {
    if (!id) return null;
    return (
      catalog.packages.find((p) => p.package_id === id)?.display_name ?? id
    );
  };
  const requestedName = nameFor(config.requested?.package_id);
  const appliedName = nameFor(config.applied?.package_id);
  const badge = STATE_BADGE[config.state];
  const isPending =
    config.state === "pending_apply" || config.state === "pending_restart";

  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          processing package
        </p>
        <span
          className={clsx(
            "rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
            badge.cls,
          )}
        >
          {badge.label}
        </span>
        {config.requested ? (
          <button
            type="button"
            onClick={onApply}
            disabled={applying}
            className={clsx(PRIMARY_BTN, "ml-auto")}
          >
            <Send className="h-3.5 w-3.5" />
            {applying ? "Applying…" : "Apply"}
          </button>
        ) : null}
      </div>

      {config.state === "unset" ? (
        <p className="mt-3 text-sm text-[var(--dn-text-50)]">
          No package selected yet — default processing is used until you request
          one below.
        </p>
      ) : (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
          <Row label="Requested" value={requestedName ?? "—"} />
          <Row label="Applied" value={appliedName ?? "Not yet running"} />
          {config.applied?.status ? (
            <Row label="Last run" value={config.applied.status} />
          ) : null}
        </dl>
      )}

      {isPending ? (
        <Banner tone="info">
          Saved. It will apply the next time this camera session starts — there
          is no live restart.
        </Banner>
      ) : null}
      {config.state === "failed_config" ? (
        <Banner tone="error">
          The requested package failed to apply. Try a different package, or
          revert to the recommended one.
        </Banner>
      ) : null}
      {config.warnings.map((w, i) => (
        <Banner key={i} tone="warn">
          {w}
        </Banner>
      ))}
    </div>
  );
}
