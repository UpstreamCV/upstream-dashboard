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
  modelsFromCatalog,
  resolveCanonicalPackage,
  trackersForModel,
} from "@/lib/perception/advanced-resolution";
import {
  computeReadiness,
  geometryReadiness,
  OVERALL_LABEL,
} from "@/lib/perception/package-readiness";
import { ModeToggle, type SetupMode } from "./mode-toggle";
import { ModelPicker } from "./model-picker";
import { ModelStatsDetail } from "./model-stats";
import { PackageCard } from "./package-card";
import { PackageDetail } from "./package-detail";
import { PackageReadinessChecklist } from "./package-readiness-checklist";
import { PackageSettingsForm } from "./package-settings-form";
import { PackageStateHeader } from "./package-state-header";
import { SetupSummary } from "./setup-summary";
import { TrackerPicker } from "./tracker-picker";
import { UseCasePicker } from "./use-case-picker";

// P5-L Processing panel — a browse-and-compare redesign. Two modes share one
// editor + the package request/apply flow (the selection always resolves to a
// package_id; no backend change):
//   • Advanced (default): pick a MODEL (rich picker with published stats) + a
//     TRACKER → resolves to the canonical package; settings/readiness behind
//     progressive disclosure.
//   • Guided: a use-case picker → the single recommended package, lighter.

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

function Disclosure({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      className="rounded-lg border border-white/10 bg-white/[0.03]"
      open={defaultOpen}
    >
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-bold text-white/80 [&::-webkit-details-marker]:hidden">
        {summary}
      </summary>
      <div className="border-t border-white/10 p-3">{children}</div>
    </details>
  );
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
  const packages = catalog.packages;

  const initialPkg = useMemo(
    () => packages.find((p) => p.package_id === requestedId) ?? null,
    [packages, requestedId],
  );
  const initial = useMemo(
    () => deriveSettings(initialPkg, requested),
    [initialPkg, requested],
  );

  const models = useMemo(() => modelsFromCatalog(packages), [packages]);

  // Initial advanced model/tracker: the requested package's, else the first model.
  const initialModelId =
    initialPkg?.model_id && models.some((m) => m.modelId === initialPkg.model_id)
      ? initialPkg.model_id
      : (models[0]?.modelId ?? null);
  const initialTrackerId = (() => {
    const tks = initialModelId ? trackersForModel(packages, initialModelId) : [];
    if (initialPkg?.tracker_profile_id && initialPkg.model_id === initialModelId) {
      return initialPkg.tracker_profile_id;
    }
    return tks[0]?.profileId ?? null;
  })();

  const [mode, setMode] = useState<SetupMode>("advanced");
  const [advModelId, setAdvModelId] = useState<string | null>(initialModelId);
  const [advTrackerId, setAdvTrackerId] = useState<string | null>(initialTrackerId);
  const [useCaseId, setUseCaseId] = useState<UseCaseId | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(requestedId);
  const [confidence, setConfidence] = useState<number | null>(initial.confidence);
  const [targetFps, setTargetFps] = useState<number | null>(initial.targetFps);
  const [allClasses, setAllClasses] = useState<boolean>(initial.allClasses);
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(
    initial.selectedClasses,
  );
  const [allowExperimental, setAllowExperimental] = useState(false);
  const [saveIssues, setSaveIssues] = useState<PackageConfigValidationIssue[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [applying, startApply] = useTransition();

  const advancedActive = useMemo(
    () =>
      advModelId && advTrackerId
        ? resolveCanonicalPackage(packages, advModelId, advTrackerId)
        : null,
    [packages, advModelId, advTrackerId],
  );
  const guidedActive = useMemo(
    () => packages.find((p) => p.package_id === selectedId) ?? null,
    [packages, selectedId],
  );
  const selected = mode === "advanced" ? advancedActive : guidedActive;

  const useCaseDef = useCaseId ? getUseCase(useCaseId) : undefined;
  const recommendations = useMemo(
    () => (useCaseDef ? recommendPackages(packages, useCaseDef) : null),
    [packages, useCaseDef],
  );

  const isSelectedSaved = selected !== null && requestedId === selected.package_id;

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

  const resetSettingsFor = useCallback(
    (pkg: ProcessingPackage | null) => {
      const d = deriveSettings(pkg, requested);
      setConfidence(d.confidence);
      setTargetFps(d.targetFps);
      setAllClasses(d.allClasses);
      setSelectedClasses(d.selectedClasses);
      setAllowExperimental(false);
      setSaveIssues([]);
      setSaveError(null);
    },
    [requested],
  );

  const switchMode = useCallback(
    (m: SetupMode) => {
      setMode(m);
      resetSettingsFor(m === "advanced" ? advancedActive : guidedActive);
    },
    [advancedActive, guidedActive, resetSettingsFor],
  );

  const chooseModel = useCallback(
    (modelId: string) => {
      const tks = trackersForModel(packages, modelId);
      const keep =
        advTrackerId && tks.some((t) => t.profileId === advTrackerId)
          ? advTrackerId
          : (tks[0]?.profileId ?? null);
      setAdvModelId(modelId);
      setAdvTrackerId(keep);
      resetSettingsFor(keep ? resolveCanonicalPackage(packages, modelId, keep) : null);
    },
    [packages, advTrackerId, resetSettingsFor],
  );

  const chooseTracker = useCallback(
    (trackerId: string) => {
      setAdvTrackerId(trackerId);
      resetSettingsFor(
        advModelId ? resolveCanonicalPackage(packages, advModelId, trackerId) : null,
      );
    },
    [packages, advModelId, resetSettingsFor],
  );

  const chooseUseCase = useCallback(
    (id: UseCaseId | null) => {
      setUseCaseId(id);
      if (!id) {
        setSelectedId(null);
        return;
      }
      const def = getUseCase(id);
      const recs = def ? recommendPackages(packages, def) : [];
      const top = recs.find((r) => r.tier === "recommended")?.pkg ?? recs[0]?.pkg ?? null;
      setSelectedId(top?.package_id ?? null);
      resetSettingsFor(top);
    },
    [packages, resetSettingsFor],
  );

  const selectGuidedPackage = useCallback(
    (pkg: ProcessingPackage) => {
      setSelectedId((cur) => (cur === pkg.package_id ? null : pkg.package_id));
      resetSettingsFor(pkg);
    },
    [resetSettingsFor],
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
      if (allowed.has("selected_classes") && !allClasses && selectedClasses.size > 0) {
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

  // Shared editor for the active package: condensed summary always visible;
  // model stats / settings / readiness behind progressive disclosure; the
  // experimental opt-in + Save stay visible.
  const editor = (pkg: ProcessingPackage) => {
    const geoR = geometryReadiness(pkg, geometry);
    const geometryHint = geoR.state === "missing" ? geoR.detail : null;
    return (
      <div className="space-y-3">
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

        <Disclosure summary="Model details & published stats">
          <div className="space-y-3">
            <ModelStatsDetail metrics={pkg.model_metrics} computeTier={pkg.compute_tier} />
            <PackageDetail pkg={pkg} />
          </div>
        </Disclosure>

        <Disclosure summary="Settings">
          <div className="space-y-3">
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
          </div>
        </Disclosure>

        {readiness ? (
          <Disclosure summary={`Readiness — ${OVERALL_LABEL[readiness.overall]}`}>
            <PackageReadinessChecklist readiness={readiness} />
          </Disclosure>
        ) : null}

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
      onSelect={() => selectGuidedPackage(pkg)}
      recommendation={recommendation}
    >
      {selectedId === pkg.package_id ? editor(pkg) : null}
    </PackageCard>
  );

  const topRec = recommendations?.find((r) => r.tier === "recommended") ?? null;
  const otherRecs = recommendations?.filter((r) => r !== topRec) ?? [];

  return (
    <div className="space-y-5">
      <PackageStateHeader
        config={config}
        catalog={catalog}
        onApply={handleApply}
        applying={applying}
      />

      <ModeToggle mode={mode} onChange={switchMode} />

      {mode === "advanced" ? (
        <section className="space-y-3">
          {models.length === 0 ? (
            <p className="text-sm text-[var(--dn-text-50)]">
              No detection models are available for this account.
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
                    Model
                  </label>
                  <ModelPicker
                    models={models}
                    selectedModelId={selected?.model_id ?? advModelId}
                    onSelect={chooseModel}
                  />
                </div>
                <TrackerPicker
                  trackers={trackersForModel(packages, selected?.model_id ?? advModelId ?? "")}
                  selected={selected?.tracker_profile_id ?? advTrackerId}
                  onSelect={chooseTracker}
                />
              </div>
              {selected ? (
                editor(selected)
              ) : (
                <p className="text-sm text-[var(--dn-text-50)]">
                  No package is available for this model + tracker combination.
                </p>
              )}
            </>
          )}
        </section>
      ) : (
        <section className="space-y-3">
          <UseCasePicker selected={useCaseId} onSelect={chooseUseCase} />
          {!useCaseId ? (
            <p className="text-xs text-[var(--dn-text-50)]">
              Pick what this camera should do to see the recommended setup.
            </p>
          ) : recommendations && topRec ? (
            <div className="space-y-3">
              {renderCard(topRec.pkg, {
                tier: topRec.tier,
                label: TIER_LABEL[topRec.tier],
              })}
              {otherRecs.length > 0 ? (
                <Disclosure summary={`Other compatible packages (${otherRecs.length})`}>
                  <div className="space-y-2">
                    {otherRecs.map((rec) =>
                      renderCard(rec.pkg, {
                        tier: rec.tier,
                        label: TIER_LABEL[rec.tier],
                      }),
                    )}
                  </div>
                </Disclosure>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--dn-text-50)]">
              No packages match that use case.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
