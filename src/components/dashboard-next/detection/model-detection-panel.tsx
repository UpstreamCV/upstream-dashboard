"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import clsx from "clsx";
import { Save, ScanEye } from "lucide-react";
import { saveProcessingConfigAction } from "@/app/dashboard/(app)/cameras/[cameraId]/configure/detection/actions";
import type {
  CameraProcessingConfig,
  ModelRegistryEntry,
} from "@/lib/api/types";
import {
  type ProcessingConfigValidationIssue,
  validateProcessingConfig,
} from "@/lib/perception/processing-config-schema";

// M5 — Model & Detection editor's brains. Owns ALL editor-local state and
// drives the Server Action. The operator picks a detection model and chooses
// which object classes to detect ("all supported" or a checked subset). The
// persistence boundary: only the CameraProcessingConfig shape is ever sent to
// the api-server, and `tracker` / `confidence_threshold` / `processing_fps`
// ride as null (those controls land in M6). The backend owns facts; the
// frontend owns hue — no styling fields cross the wire.

const SELECT_CLASS =
  "rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition focus:border-[var(--dn-creek-mid)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50";

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
  // is meaningless. Reset to "all supported" ON and clear the subset.
  const handleModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const nextKey = e.target.value;
      setSelectedModelKey(nextKey);
      setAllClasses(true);
      setSelectedClasses(new Set());
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
      tracker: null,
      confidence_threshold: null,
      processing_fps: null,
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
    router,
    selectedClasses,
    selectedModel,
    selectedModelKey,
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

      <ModelInfo model={selectedModel} />

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
          <h2 className="mt-1 font-bold text-[clamp(1.1rem,1.6vw,1.5rem)] text-black">
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
      <h3 className="mt-1 font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">
        Object classes
      </h3>

      <label className="mt-4 flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={allClasses}
          onChange={onAllClassesToggle}
          className="h-4 w-4 rounded border-black/20 accent-[var(--dn-creek-mid)]"
        />
        <span className="text-sm font-bold text-black">
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
                      : "cursor-pointer text-black",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={allClasses}
                    onChange={() => onClassToggle(className)}
                    className="h-4 w-4 rounded border-black/20 accent-[var(--dn-creek-mid)] disabled:opacity-50"
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

// --- read-only model info ---------------------------------------------------

function ModelInfo({ model }: { model: ModelRegistryEntry | undefined }) {
  if (model === undefined) return null;
  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
        model info
      </p>
      {model.description ? (
        <p className="mt-2 text-sm text-black/80">{model.description}</p>
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
        Tracker, confidence threshold, and processing FPS are configured in a
        later milestone (M6) — saved as defaults for now.
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
      <dd className="mt-0.5 font-mono text-black/80">{value}</dd>
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
