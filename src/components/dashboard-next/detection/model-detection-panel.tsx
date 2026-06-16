"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import clsx from "clsx";
import { Info, Save, ScanEye } from "lucide-react";
import { saveProcessingConfigAction } from "@/app/(dash)/(app)/cameras/[cameraId]/configure/detection/actions";
import type {
  CameraProcessingConfig,
  ModelRegistryEntry,
} from "@/lib/api/types";
import {
  type ProcessingConfigValidationIssue,
  validateProcessingConfig,
} from "@/lib/perception/processing-config-schema";

// M5/M6 — Model & Detection editor's brains. Owns ALL editor-local state and
// drives the Server Action. The operator picks a detection model, chooses which
// object classes to detect ("all supported" or a checked subset), and (M6) the
// tracker, confidence threshold, and processing FPS — each defaulting to the
// runtime/model default (null). The persistence boundary: only the
// CameraProcessingConfig shape is ever sent to the api-server. The backend owns
// facts; the frontend owns hue — no styling fields cross the wire.
//
// Honest status: these settings persist to a real api-server endpoint, but the
// live processor does NOT consume them yet — runtime/detection behavior is
// unchanged until the processor-config milestone. The notice block says so.

const SELECT_CLASS =
  "rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const NUMBER_CLASS =
  "w-20 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50";
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/80 transition hover:border-[var(--dn-creek-mid)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

// Processing-FPS choices the dashboard offers. `null` = use the runtime/source
// default. Values stay within the api-server's [1, 30] integer bound.
const FPS_OPTIONS: number[] = [1, 2, 5, 10, 15, 30];

interface ModelDetectionPanelProps {
  cameraId: string;
  models: ModelRegistryEntry[];
  initialConfig: CameraProcessingConfig;
  isDefault: boolean;
}

export function ModelDetectionPanel({
  cameraId,
  models,
  initialConfig,
  isDefault,
}: ModelDetectionPanelProps) {
  const router = useRouter();

  const [selectedModelKey, setSelectedModelKey] = useState<string>(
    initialConfig.model_key,
  );
  // `selected_classes === []` is the "all supported classes" sentinel.
  const [allClasses, setAllClasses] = useState<boolean>(
    initialConfig.selected_classes.length === 0,
  );
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(
    () => new Set(initialConfig.selected_classes),
  );
  // M6 controls. `null` is the "use runtime/model default" sentinel for each.
  const [tracker, setTracker] = useState<string | null>(initialConfig.tracker);
  const [confidence, setConfidence] = useState<number | null>(
    initialConfig.confidence_threshold,
  );
  const [fps, setFps] = useState<number | null>(initialConfig.processing_fps);
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveIssues, setSaveIssues] = useState<ProcessingConfigValidationIssue[]>(
    [],
  );
  const [saving, startTransition] = useTransition();

  const selectedModel = useMemo(
    () => models.find((m) => m.model_key === selectedModelKey),
    [models, selectedModelKey],
  );

  // Changing models means a different supported_classes set, so the old subset
  // is meaningless. Reset to "all supported" ON and clear the subset. The
  // tracker is also model-scoped: if the current pick isn't in the new model's
  // supported_trackers, snap it back to the runtime default (null).
  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nextKey = e.target.value;
      const nextModel = models.find((m) => m.model_key === nextKey);
      setSelectedModelKey(nextKey);
      setAllClasses(true);
      setSelectedClasses(new Set());
      setTracker((prev) =>
        prev !== null &&
        nextModel !== undefined &&
        !nextModel.supported_trackers.includes(prev)
          ? null
          : prev,
      );
      setDirty(true);
      setSaveError(null);
      setSaveIssues([]);
    },
    [models],
  );

  const handleTrackerChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      // "" is the option value for the runtime default → store as null.
      setTracker(e.target.value === "" ? null : e.target.value);
      setDirty(true);
      setSaveError(null);
      setSaveIssues([]);
    },
    [],
  );

  const handleConfidenceChange = useCallback((value: number | null) => {
    setConfidence(value);
    setDirty(true);
    setSaveError(null);
    setSaveIssues([]);
  }, []);

  const handleFpsChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setFps(e.target.value === "" ? null : Number(e.target.value));
      setDirty(true);
      setSaveError(null);
      setSaveIssues([]);
    },
    [],
  );

  const handleAllClassesToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setAllClasses(e.target.checked);
      setDirty(true);
      setSaveError(null);
      setSaveIssues([]);
    },
    [],
  );

  const handleClassToggle = useCallback((className: string) => {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(className)) {
        next.delete(className);
      } else {
        next.add(className);
      }
      return next;
    });
    setDirty(true);
    setSaveError(null);
    setSaveIssues([]);
  }, []);

  const handleSave = useCallback(() => {
    const config: CameraProcessingConfig = {
      version: 1,
      model_key: selectedModelKey,
      selected_classes: allClasses ? [] : [...selectedClasses],
      tracker,
      confidence_threshold: confidence,
      processing_fps: fps,
    };

    const issues = validateProcessingConfig(config, selectedModel);
    if (issues.length > 0) {
      setSaveIssues(issues);
      setSaveError(
        issues[0]?.message ?? "Fix validation issues before saving.",
      );
      return;
    }

    setSaveIssues([]);
    setSaveError(null);

    const form = new FormData();
    form.set("camera_id", cameraId);
    form.set("config", JSON.stringify(config));

    startTransition(async () => {
      const result = await saveProcessingConfigAction(form);
      if (result.ok) {
        toast.success("Detection config saved");
        setDirty(false);
        router.refresh();
        return;
      }
      if (result.issues) {
        setSaveIssues(result.issues);
      }
      setSaveError(result.message);
      toast.error(result.message);
    });
  }, [
    allClasses,
    cameraId,
    confidence,
    fps,
    router,
    selectedClasses,
    selectedModel,
    selectedModelKey,
    tracker,
  ]);

  // When NOT "all supported", the operator must check at least one class.
  const subsetEmpty = !allClasses && selectedClasses.size === 0;
  const canSave = dirty && !saving && !subsetEmpty;

  return (
    <div className="space-y-4 md:space-y-6">
      <ModelPicker
        models={models}
        selectedModelKey={selectedModelKey}
        onChange={handleModelChange}
      />

      <ClassSelection
        model={selectedModel}
        allClasses={allClasses}
        selectedClasses={selectedClasses}
        subsetEmpty={subsetEmpty}
        onAllClassesToggle={handleAllClassesToggle}
        onClassToggle={handleClassToggle}
      />

      <DetectionTuning
        model={selectedModel}
        tracker={tracker}
        confidence={confidence}
        fps={fps}
        onTrackerChange={handleTrackerChange}
        onConfidenceChange={handleConfidenceChange}
        onFpsChange={handleFpsChange}
      />

      <ModelInfo model={selectedModel} />

      <NotLiveNotice />

      <div className="dn-tile flex flex-wrap items-center gap-2 p-3">
        {dirty ? (
          <span className="rounded-full bg-[#8a6d1f]/15 px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-[#8a6d1f]">
            unsaved
          </span>
        ) : (
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
            {isDefault ? "not configured yet" : "saved"}
          </span>
        )}
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          {allClasses
            ? "all supported classes"
            : `${selectedClasses.size} class${selectedClasses.size === 1 ? "" : "es"} selected`}
        </span>
        <span aria-hidden className="text-[var(--dn-text-50)]">
          ·
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          tracker {tracker ?? "default"}
        </span>
        <span aria-hidden className="text-[var(--dn-text-50)]">
          ·
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          conf {confidence === null ? "default" : confidence.toFixed(2)}
        </span>
        <span aria-hidden className="text-[var(--dn-text-50)]">
          ·
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          {fps === null ? "fps default" : `${fps} fps`}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className={clsx(PRIMARY_BTN, "ml-auto")}
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {saveIssues.length > 0 ? (
        <ValidationList issues={saveIssues} />
      ) : saveError ? (
        <p
          className="rounded-lg border border-[#c0473b]/30 bg-[#c0473b]/[0.08] p-3 text-sm text-[#c0473b]"
          role="alert"
        >
          {saveError}
        </p>
      ) : null}
    </div>
  );
}

// --- model picker -----------------------------------------------------------

function ModelPicker({
  models,
  selectedModelKey,
  onChange,
}: {
  models: ModelRegistryEntry[];
  selectedModelKey: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  // If the saved model_key isn't in the registry (e.g. retired), surface it as
  // a disabled placeholder so the <select> still shows the operator's choice
  // rather than silently snapping to the first option.
  const known = models.some((m) => m.model_key === selectedModelKey);

  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex items-start gap-3">
        <ScanEye
          className="h-6 w-6 shrink-0 text-[var(--dn-creek-mid)]"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            detection model
          </p>
          <h2 className="mt-1 font-bold text-[clamp(1.1rem,1.6vw,1.5rem)] text-white">
            Which model runs on this camera?
          </h2>
          <p className="mt-2 text-sm text-[var(--dn-text-50)]">
            Pick the detector for this camera&rsquo;s stream. Disabled models
            can&rsquo;t be selected. The processor applies the saved model on
            the camera&rsquo;s next session.
          </p>
          <label className="mt-4 flex flex-col gap-1.5">
            <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
              Model
            </span>
            <select
              value={selectedModelKey}
              onChange={onChange}
              className={clsx(SELECT_CLASS, "max-w-md")}
            >
              {!known ? (
                <option value={selectedModelKey} disabled>
                  {selectedModelKey} (unavailable)
                </option>
              ) : null}
              {models.map((m) => (
                <option
                  key={m.model_key}
                  value={m.model_key}
                  disabled={!m.enabled}
                >
                  {m.display_name}
                  {m.enabled ? "" : " (disabled)"}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}

// --- class selection --------------------------------------------------------

function ClassSelection({
  model,
  allClasses,
  selectedClasses,
  subsetEmpty,
  onAllClassesToggle,
  onClassToggle,
}: {
  model: ModelRegistryEntry | undefined;
  allClasses: boolean;
  selectedClasses: Set<string>;
  subsetEmpty: boolean;
  onAllClassesToggle: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClassToggle: (className: string) => void;
}) {
  const supported = model?.supported_classes ?? [];

  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        what to detect?
      </p>
      <h3 className="mt-1 font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-white">
        Object classes
      </h3>

      <label className="mt-4 flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={allClasses}
          onChange={onAllClassesToggle}
          className="h-4 w-4 rounded border-white/10 accent-[var(--dn-creek-mid)]"
        />
        <span className="text-sm font-bold text-white">
          All supported classes
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          ({supported.length} supported)
        </span>
      </label>
      <p className="mt-1.5 text-xs text-[var(--dn-text-50)]">
        {allClasses
          ? "Every class this model supports is detected. Saved as an empty list — the processor reads it as “all supported”."
          : "Detect only the checked classes. At least one is required."}
      </p>

      {model === undefined ? (
        <p className="mt-4 text-sm text-[var(--dn-text-50)]">
          Select an available model to choose object classes.
        </p>
      ) : supported.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--dn-text-50)]">
          This model doesn&rsquo;t publish a class list. Detection covers
          whatever it natively supports.
        </p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {supported.map((className) => {
            const checked = allClasses || selectedClasses.has(className);
            return (
              <li key={className}>
                <label
                  className={clsx(
                    "flex items-center gap-2 text-sm",
                    allClasses
                      ? "cursor-not-allowed text-[var(--dn-text-50)]"
                      : "cursor-pointer text-white",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={allClasses}
                    onChange={() => onClassToggle(className)}
                    className="h-4 w-4 rounded border-white/10 accent-[var(--dn-creek-mid)] disabled:opacity-50"
                  />
                  <span className="font-mono">{className}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {subsetEmpty ? (
        <p
          className="mt-4 rounded-lg border border-[#8a6d1f]/30 bg-[#8a6d1f]/[0.08] p-2.5 text-xs text-[#8a6d1f]"
          role="status"
        >
          Check at least one class, or turn on “All supported classes”.
        </p>
      ) : null}
    </div>
  );
}

// --- detection tuning (tracker / confidence / FPS) --------------------------

function DetectionTuning({
  model,
  tracker,
  confidence,
  fps,
  onTrackerChange,
  onConfidenceChange,
  onFpsChange,
}: {
  model: ModelRegistryEntry | undefined;
  tracker: string | null;
  confidence: number | null;
  fps: number | null;
  onTrackerChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onConfidenceChange: (value: number | null) => void;
  onFpsChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        how to detect?
      </p>
      <h3 className="mt-1 font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-white">
        Tracker, confidence &amp; processing rate
      </h3>
      <p className="mt-1.5 text-xs text-[var(--dn-text-50)]">
        Leave any control on its default to keep the model&rsquo;s or
        runtime&rsquo;s built-in value.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TrackerControl
          model={model}
          tracker={tracker}
          onChange={onTrackerChange}
        />
        <FpsControl fps={fps} onChange={onFpsChange} />
        <div className="sm:col-span-2">
          <ConfidenceControl
            model={model}
            confidence={confidence}
            onChange={onConfidenceChange}
          />
        </div>
      </div>
    </div>
  );
}

function TrackerControl({
  model,
  tracker,
  onChange,
}: {
  model: ModelRegistryEntry | undefined;
  tracker: string | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const supported = model?.supported_trackers ?? [];
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        Tracker
      </span>
      <select
        aria-label="Tracker"
        value={tracker ?? ""}
        onChange={onChange}
        className={clsx(SELECT_CLASS, "max-w-xs")}
      >
        <option value="">Runtime default</option>
        {supported.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <span className="text-xs text-[var(--dn-text-50)]">
        {tracker === null
          ? "Use runtime default tracker."
          : `Tracking objects with ${tracker}.`}
      </span>
    </label>
  );
}

function ConfidenceControl({
  model,
  confidence,
  onChange,
}: {
  model: ModelRegistryEntry | undefined;
  confidence: number | null;
  onChange: (value: number | null) => void;
}) {
  // Range/number share one value. When null, the slider rests at the model
  // default (or 0.5) for a sensible thumb position, but the saved value stays
  // null until the operator moves it.
  const fallback = model?.default_confidence_threshold ?? 0.5;
  const sliderValue = confidence ?? fallback;
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        Confidence threshold
      </legend>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label="Confidence threshold"
          min={0}
          max={1}
          step={0.05}
          value={sliderValue}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 max-w-xs flex-1 accent-[var(--dn-creek-mid)]"
        />
        <input
          type="number"
          aria-label="Confidence threshold value"
          min={0}
          max={1}
          step={0.05}
          value={confidence ?? ""}
          placeholder={fallback.toFixed(2)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          className={NUMBER_CLASS}
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          disabled={confidence === null}
          className={GHOST_BTN}
        >
          Use default
        </button>
      </div>
      <span className="text-xs text-[var(--dn-text-50)]">
        {confidence === null ? (
          <>
            Use model/runtime default.
            {model?.default_confidence_threshold != null
              ? ` Model default: ${model.default_confidence_threshold}.`
              : ""}
          </>
        ) : (
          `Detect objects at or above ${confidence.toFixed(2)} confidence.`
        )}
      </span>
    </fieldset>
  );
}

function FpsControl({
  fps,
  onChange,
}: {
  fps: number | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        Processing FPS
      </span>
      <select
        aria-label="Processing FPS"
        value={fps ?? ""}
        onChange={onChange}
        className={clsx(SELECT_CLASS, "max-w-xs")}
      >
        <option value="">Default</option>
        {FPS_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n} FPS
          </option>
        ))}
      </select>
      <span className="text-xs text-[var(--dn-text-50)]">
        {fps === null
          ? "Use runtime/source default."
          : `Process ${fps} frame${fps === 1 ? "" : "s"} per second.`}
      </span>
    </label>
  );
}

// --- not-live-yet notice ----------------------------------------------------

// Calm, muted info tile (NOT an error color). The settings persist, but the
// live processor does not consume them yet — be honest about that.
function NotLiveNotice() {
  return (
    <div
      className="dn-tile flex items-start gap-2.5 border border-white/10 bg-white/[0.04] p-3"
      role="note"
    >
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--dn-text-50)]"
        aria-hidden
      />
      <p className="text-xs text-[var(--dn-text-50)]">
        This saves the intended model &amp; detection config for this camera.
        Live processor consumption isn&rsquo;t enabled yet — runtime behavior is
        unchanged until the processor-config milestone.
      </p>
    </div>
  );
}

// --- read-only model info ---------------------------------------------------

function ModelInfo({ model }: { model: ModelRegistryEntry | undefined }) {
  if (model === undefined) return null;
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        model info
      </p>
      {model.description ? (
        <p className="mt-2 text-sm text-white/80">{model.description}</p>
      ) : null}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
        <InfoCell label="runtime" value={model.runtime} />
        <InfoCell
          label="default confidence"
          value={
            model.default_confidence_threshold === null
              ? "—"
              : model.default_confidence_threshold.toString()
          }
        />
        <InfoCell
          label="resource profile"
          value={model.resource_profile ?? "—"}
        />
        <InfoCell
          label="supported trackers"
          value={
            model.supported_trackers.length > 0
              ? model.supported_trackers.join(", ")
              : "—"
          }
        />
      </dl>
      {model.limitations && model.limitations.length > 0 ? (
        <div className="mt-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
            limitations
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-[var(--dn-text-50)]">
            {model.limitations.map((limitation, idx) => (
              <li key={idx}>{limitation}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-[var(--dn-text-50)]">
        These are read-only registry facts. Tracker, confidence threshold, and
        processing FPS are configured above; leaving any at its default keeps
        the model&rsquo;s/runtime&rsquo;s built-in value.
      </p>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-white/80">{value}</dd>
    </div>
  );
}

// --- validation list --------------------------------------------------------

function ValidationList({
  issues,
}: {
  issues: ProcessingConfigValidationIssue[];
}) {
  return (
    <div
      className="rounded-lg border border-[#c0473b]/30 bg-[#c0473b]/[0.08] p-3"
      role="alert"
    >
      <p className="font-bold text-sm text-[#c0473b]">
        Fix these before saving
      </p>
      <ul className="mt-2 space-y-1 text-xs text-[#c0473b]">
        {issues.slice(0, 8).map((issue, idx) => (
          <li key={`${issue.field}-${idx}`} className="font-mono">
            {issue.field}: {issue.message}
          </li>
        ))}
        {issues.length > 8 ? (
          <li className="font-mono opacity-70">
            … and {issues.length - 8} more
          </li>
        ) : null}
      </ul>
    </div>
  );
}
