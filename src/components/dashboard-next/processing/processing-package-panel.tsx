"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import {
  applyCameraPackageAction,
  saveCameraPackageAction,
} from "@/app/(dash)/(app)/(fleet)/cameras/[cameraId]/processing/actions";
import type {
  CameraPackageConfigResponse,
  CameraPackageRequest,
  CameraPackageSettings,
  GeometryConfigRecord,
  ProcessingPackage,
  ProcessingPackageCatalogResponse,
  RequestedPackageConfig,
} from "@/lib/api/types";
import {
  type PackageConfigValidationIssue,
  validatePackageRequest,
} from "@/lib/perception/package-config-schema";
import {
  getUseCase,
  recommendPackages,
  TIER_LABEL,
  type RecommendationTier,
  type UseCaseId,
} from "@/lib/perception/package-recommendation";
import {
  computeReadiness,
  geometryReadiness,
} from "@/lib/perception/package-readiness";
import { PackageCard } from "./package-card";
import { PackageDetail } from "./package-detail";
import { PackageReadinessChecklist } from "./package-readiness-checklist";
import { PackageSettingsForm } from "./package-settings-form";
import { PackageStateHeader } from "./package-state-header";
import { SetupSummary } from "./setup-summary";
import { UseCasePicker } from "./use-case-picker";

// P5-I Processing panel — the P5-H package selector plus a guided setup layer:
// a use-case picker that ranks the catalog (metadata-driven), a per-package
// readiness checklist (geometry / settings / saved / applied), and a pre-save
// setup summary. With no use case selected the catalog renders exactly as P5-H.

const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50";

interface EditorSettings {
  confidence: number | null;
  targetFps: number | null;
  allClasses: boolean;
  selectedClasses: Set<string>;
}

function deriveSettings(
  pkg: ProcessingPackage | null,
  requested: RequestedPackageConfig | null,
): EditorSettings {
  const s =
    requested && pkg && requested.package_id === pkg.package_id
      ? requested.settings
      : undefined;
  const classes = s?.selected_classes ?? [];
  return {
    confidence: s?.confidence_threshold ?? null,
    targetFps: s?.target_fps ?? null,
    allClasses: classes.length === 0,
    selectedClasses: new Set<string>(classes),
  };
}

export function ProcessingPackagePanel({
  cameraId,
  catalog,
  config,
  geometry,
}: {
  cameraId: string;
  catalog: ProcessingPackageCatalogResponse;
  config: CameraPackageConfigResponse;
  geometry: GeometryConfigRecord | null;
}) {
  const router = useRouter();
  const requested = config.requested;
  const requestedId = requested?.package_id ?? null;

  const initialPkg = useMemo(
    () => catalog.packages.find((p) => p.package_id === requestedId) ?? null,
    [catalog.packages, requestedId],
  );
  const initial = useMemo(
    () => deriveSettings(initialPkg, requested),
    [initialPkg, requested],
  );

  const [useCaseId, setUseCaseId] = useState<UseCaseId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [confidence, setConfidence] = useState<number | null>(
    initial.confidence,
  );
  const [targetFps, setTargetFps] = useState<number | null>(initial.targetFps);
  const [allClasses, setAllClasses] = useState<boolean>(initial.allClasses);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(
    initial.selectedClasses,
  );
  const [allowExperimental, setAllowExperimental] = useState(false);
  const [saveIssues, setSaveIssues] = useState<PackageConfigValidationIssue[]>(
    [],
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [applying, startApply] = useTransition();

  const selected = useMemo(
    () => catalog.packages.find((p) => p.package_id === selectedId) ?? null,
    [catalog.packages, selectedId],
  );

  const useCaseDef = useCaseId ? getUseCase(useCaseId) : undefined;
  const recommendations = useMemo(
    () => (useCaseDef ? recommendPackages(catalog.packages, useCaseDef) : null),
    [catalog.packages, useCaseDef],
  );

  const isSelectedSaved =
    selected !== null && requestedId === selected.package_id;

  const readiness = useMemo(
    () =>
      selected
        ? computeReadiness({
            pkg: selected,
            config,
            geometry,
            allowExperimental,
            isSelectedSaved,
            settings: {
              confidence,
              targetFps,
              allClasses,
              selectedClassCount: selectedClasses.size,
            },
          })
        : null,
    [
      selected,
      config,
      geometry,
      allowExperimental,
      isSelectedSaved,
      confidence,
      targetFps,
      allClasses,
      selectedClasses,
    ],
  );

  const selectPackage = useCallback(
    (pkg: ProcessingPackage) => {
      if (pkg.package_id === selectedId) {
        setSelectedId(null);
        return;
      }
      setSelectedId(pkg.package_id);
      const d = deriveSettings(pkg, requested);
      setConfidence(d.confidence);
      setTargetFps(d.targetFps);
      setAllClasses(d.allClasses);
      setSelectedClasses(d.selectedClasses);
      setAllowExperimental(false);
      setSaveIssues([]);
      setSaveError(null);
    },
    [requested, selectedId],
  );

  const handleToggleClass = useCallback((className: string) => {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) next.delete(className);
      else next.add(className);
      return next;
    });
    setSaveIssues([]);
    setSaveError(null);
  }, []);

  const buildRequest = useCallback(
    (pkg: ProcessingPackage): CameraPackageRequest => {
      const allowed = new Set(pkg.allowed_overrides);
      const settings: CameraPackageSettings = {};
      if (allowed.has("confidence_threshold") && confidence !== null) {
        settings.confidence_threshold = confidence;
      }
      if (allowed.has("processing_fps") && targetFps !== null) {
        settings.target_fps = targetFps;
      }
      if (
        allowed.has("selected_classes") &&
        !allClasses &&
        selectedClasses.size > 0
      ) {
        settings.selected_classes = [...selectedClasses];
      }
      return {
        package_id: pkg.package_id,
        settings,
        allow_experimental: allowExperimental,
      };
    },
    [allClasses, allowExperimental, confidence, selectedClasses, targetFps],
  );

  const showClasses =
    !!selected &&
    selected.allowed_overrides.includes("selected_classes") &&
    selected.supported_classes.length > 0;
  const subsetEmpty = showClasses && !allClasses && selectedClasses.size === 0;
  const needsOptIn = selected?.status === "experimental" && !allowExperimental;
  const canSave = !!selected && !saving && !subsetEmpty && !needsOptIn;

  const handleSave = useCallback(() => {
    if (!selected) return;
    const request = buildRequest(selected);
    const issues = validatePackageRequest(request, selected);
    if (issues.length > 0) {
      setSaveIssues(issues);
      setSaveError(issues[0]?.message ?? "Fix validation issues before saving.");
      return;
    }
    setSaveIssues([]);
    setSaveError(null);

    const form = new FormData();
    form.set("camera_id", cameraId);
    form.set("request", JSON.stringify(request));

    startSave(async () => {
      const result = await saveCameraPackageAction(form);
      if (result.ok) {
        toast.success("Package request saved");
        router.refresh();
        return;
      }
      if (result.issues) setSaveIssues(result.issues);
      setSaveError(result.message);
      toast.error(result.message);
    });
  }, [buildRequest, cameraId, router, selected]);

  const handleApply = useCallback(() => {
    const form = new FormData();
    form.set("camera_id", cameraId);
    startApply(async () => {
      const result = await applyCameraPackageAction(form);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        return;
      }
      toast.error(result.message);
    });
  }, [cameraId, router]);

  // The expanded editor + guided panels for the selected package.
  const expandedContent = (pkg: ProcessingPackage) => {
    const geoR = geometryReadiness(pkg, geometry);
    const geometryHint = geoR.state === "missing" ? geoR.detail : null;
    return (
      <div className="space-y-4">
        <PackageDetail pkg={pkg} />

        {readiness ? <PackageReadinessChecklist readiness={readiness} /> : null}

        {pkg.status === "experimental" ? (
          <label className="flex items-start gap-2 rounded-lg border border-[var(--dn-orange)]/30 bg-[var(--dn-orange-soft)] p-2.5">
            <input
              type="checkbox"
              checked={allowExperimental}
              onChange={(e) => setAllowExperimental(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--dn-orange)]"
            />
            <span className="text-xs text-[var(--dn-orange)]">
              I understand this package is experimental and not recommended for
              production.
            </span>
          </label>
        ) : null}

        <PackageSettingsForm
          pkg={pkg}
          confidence={confidence}
          targetFps={targetFps}
          allClasses={allClasses}
          selectedClasses={selectedClasses}
          subsetEmpty={subsetEmpty}
          onConfidence={(v) => {
            setConfidence(v);
            setSaveIssues([]);
            setSaveError(null);
          }}
          onTargetFps={(v) => {
            setTargetFps(v);
            setSaveIssues([]);
            setSaveError(null);
          }}
          onAllClasses={(v) => {
            setAllClasses(v);
            setSaveIssues([]);
            setSaveError(null);
          }}
          onToggleClass={handleToggleClass}
        />

        {pkg.requires_geometry ? (
          <p className="text-xs text-[var(--dn-text-50)]">
            This package needs line/ROI geometry to emit events. Draw it under
            the{" "}
            <a
              href={`/cameras/${cameraId}/configure/geometry`}
              className="text-[var(--dn-creek-mid)] underline"
            >
              Configure → Geometry
            </a>{" "}
            editor.
          </p>
        ) : null}

        <SetupSummary
          pkg={pkg}
          useCase={useCaseDef ?? null}
          settings={{
            confidence,
            targetFps,
            allClasses,
            selectedClassCount: selectedClasses.size,
          }}
          config={config}
          geometryHint={geometryHint}
        />

        {saveIssues.length > 0 ? (
          <div
            className="rounded-lg border border-[var(--dn-red)]/30 bg-[var(--dn-red-soft)] p-3"
            role="alert"
          >
            <p className="text-sm font-bold text-[var(--dn-red)]">
              Fix these before saving
            </p>
            <ul className="mt-2 space-y-1 text-xs text-[var(--dn-red)]">
              {saveIssues.slice(0, 8).map((issue, idx) => (
                <li key={`${issue.field}-${idx}`} className="font-mono">
                  {issue.field}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : saveError ? (
          <p
            className="rounded-lg border border-[var(--dn-red)]/30 bg-[var(--dn-red-soft)] p-3 text-sm text-[var(--dn-red)]"
            role="alert"
          >
            {saveError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={PRIMARY_BTN}
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? "Saving…" : "Save request"}
          </button>
          <span className="text-xs text-[var(--dn-text-50)]">
            {pkg.requires_restart
              ? "Applies on the camera’s next session."
              : "Applies on the next processing run."}
          </span>
        </div>
      </div>
    );
  };

  const renderCard = (
    pkg: ProcessingPackage,
    recommendation?: { tier: RecommendationTier; label: string },
  ) => (
    <PackageCard
      key={pkg.package_id}
      pkg={pkg}
      selected={pkg.package_id === selectedId}
      isRequested={pkg.package_id === requestedId}
      onSelect={() => selectPackage(pkg)}
      recommendation={recommendation}
    >
      {selected && selected.package_id === pkg.package_id
        ? expandedContent(selected)
        : null}
    </PackageCard>
  );

  return (
    <div className="space-y-5">
      <PackageStateHeader
        config={config}
        catalog={catalog}
        onApply={handleApply}
        applying={applying}
      />

      <UseCasePicker selected={useCaseId} onSelect={setUseCaseId} />

      <section className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          {recommendations ? "recommended packages" : "available packages"}
        </h2>
        {!recommendations ? (
          <p className="text-xs text-[var(--dn-text-50)]">
            Not sure? Pick what this camera should do above to see the recommended
            package for that use case.
          </p>
        ) : null}
        {catalog.packages.length === 0 ? (
          <p className="text-sm text-[var(--dn-text-50)]">
            No processing packages are available for this account.
          </p>
        ) : recommendations ? (
          <div className="space-y-2">
            {recommendations.map((rec) =>
              renderCard(rec.pkg, {
                tier: rec.tier,
                label: TIER_LABEL[rec.tier],
              }),
            )}
          </div>
        ) : (
          catalog.categories.map((category) => {
            const pkgs = catalog.packages.filter(
              (p) => p.category === category.id,
            );
            if (pkgs.length === 0) return null;
            return (
              <div key={category.id} className="space-y-2">
                <h3 className="text-sm font-bold text-white/80">
                  {category.display_name}
                </h3>
                {pkgs.map((pkg) => renderCard(pkg))}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
