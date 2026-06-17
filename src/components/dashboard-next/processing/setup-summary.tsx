"use client";

import type {
  CameraPackageConfigResponse,
  ProcessingPackage,
} from "@/lib/api/types";
import type { UseCaseDef } from "@/lib/perception/package-recommendation";
import type { ReadinessSettings } from "@/lib/perception/package-readiness";

// P5-I safer apply flow — a plain-language summary shown above Save/Apply so the
// operator confirms what they're requesting and, crucially, WHEN it takes
// effect (next session — never a live restart).

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        {label}
      </span>
      <span
        className={
          tone === "warn" ? "text-[var(--dn-orange)]" : "text-white/85"
        }
      >
        {value}
      </span>
    </div>
  );
}

function settingsSummary(
  pkg: ProcessingPackage,
  s: ReadinessSettings,
): string {
  const parts: string[] = [];
  if (pkg.allowed_overrides.includes("selected_classes")) {
    parts.push(
      s.allClasses ? "all classes" : `${s.selectedClassCount} class(es)`,
    );
  }
  if (pkg.allowed_overrides.includes("confidence_threshold")) {
    parts.push(
      s.confidence === null ? "default confidence" : `conf ${s.confidence.toFixed(2)}`,
    );
  }
  if (pkg.allowed_overrides.includes("processing_fps")) {
    parts.push(s.targetFps === null ? "default FPS" : `${s.targetFps} FPS`);
  }
  return parts.length > 0 ? parts.join(" · ") : "package defaults";
}

export function SetupSummary({
  pkg,
  useCase,
  settings,
  config,
  geometryHint,
}: {
  pkg: ProcessingPackage;
  useCase: UseCaseDef | null;
  settings: ReadinessSettings;
  config: CameraPackageConfigResponse;
  /** A short "missing X" string when geometry is required but absent, else null. */
  geometryHint: string | null;
}) {
  const appliedId = config.applied?.package_id ?? null;
  const differentApplied = appliedId !== null && appliedId !== pkg.package_id;

  return (
    <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm">
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        before you save
      </p>
      <Row label="Package" value={pkg.display_name} />
      {useCase ? <Row label="Use case" value={useCase.label} /> : null}
      <Row label="Settings" value={settingsSummary(pkg, settings)} />
      {pkg.warnings.length > 0 ? (
        <Row label="Warning" value={pkg.warnings[0]} tone="warn" />
      ) : null}
      {geometryHint ? (
        <Row label="Geometry" value={geometryHint} tone="warn" />
      ) : null}
      <Row
        label="Takes effect"
        value="On the next session/restart. The live processor is not restarted."
      />
      {differentApplied ? (
        <p className="pt-1 text-xs text-[var(--dn-orange)]">
          This camera is currently running a different package ({appliedId}).
          Your change will show as pending until the next session.
        </p>
      ) : null}
    </div>
  );
}
