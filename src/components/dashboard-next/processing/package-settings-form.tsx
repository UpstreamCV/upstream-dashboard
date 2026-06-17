"use client";

import clsx from "clsx";
import type { ProcessingPackage } from "@/lib/api/types";

// Safe-settings editor for one package. Renders a control ONLY for each key the
// package lists in `allowed_overrides` ("confidence_threshold",
// "processing_fps" (shown as Target FPS), "selected_classes"). Unsupported keys
// are never given fake controls. `null`/unset means "use the package default".

const SELECT_CLASS =
  "rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-1.5 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none";
const NUMBER_CLASS =
  "w-20 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none";
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/80 transition hover:border-[var(--dn-creek-mid)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

const FPS_OPTIONS = [1, 2, 5, 10, 15, 30];

export interface PackageSettingsFormProps {
  pkg: ProcessingPackage;
  confidence: number | null;
  targetFps: number | null;
  allClasses: boolean;
  selectedClasses: Set<string>;
  subsetEmpty: boolean;
  onConfidence: (value: number | null) => void;
  onTargetFps: (value: number | null) => void;
  onAllClasses: (value: boolean) => void;
  onToggleClass: (className: string) => void;
}

export function PackageSettingsForm({
  pkg,
  confidence,
  targetFps,
  allClasses,
  selectedClasses,
  subsetEmpty,
  onConfidence,
  onTargetFps,
  onAllClasses,
  onToggleClass,
}: PackageSettingsFormProps) {
  const allowed = new Set(pkg.allowed_overrides);
  const showConfidence = allowed.has("confidence_threshold");
  const showFps = allowed.has("processing_fps");
  const showClasses = allowed.has("selected_classes");

  if (!showConfidence && !showFps && !showClasses) {
    return (
      <p className="text-sm text-[var(--dn-text-50)]">
        This package has no adjustable settings.
      </p>
    );
  }

  const defaults = pkg.default_settings as {
    confidence_threshold?: number;
    target_fps?: number;
  };

  return (
    <div className="space-y-4">
      {showClasses ? (
        pkg.supported_classes.length > 0 ? (
          <ClassControl
            supported={pkg.supported_classes}
            allClasses={allClasses}
            selectedClasses={selectedClasses}
            subsetEmpty={subsetEmpty}
            onAllClasses={onAllClasses}
            onToggleClass={onToggleClass}
          />
        ) : (
          <p className="text-xs text-[var(--dn-text-50)]">
            This package detects all classes the model supports — no class
            subset is available.
          </p>
        )
      ) : null}

      {showConfidence || showFps ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {showConfidence ? (
            <ConfidenceControl
              confidence={confidence}
              fallback={defaults.confidence_threshold ?? 0.5}
              onChange={onConfidence}
            />
          ) : null}
          {showFps ? (
            <FpsControl
              fps={targetFps}
              fallback={defaults.target_fps ?? null}
              onChange={onTargetFps}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ClassControl({
  supported,
  allClasses,
  selectedClasses,
  subsetEmpty,
  onAllClasses,
  onToggleClass,
}: {
  supported: string[];
  allClasses: boolean;
  selectedClasses: Set<string>;
  subsetEmpty: boolean;
  onAllClasses: (value: boolean) => void;
  onToggleClass: (className: string) => void;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        object classes
      </p>
      <label className="mt-2 flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={allClasses}
          onChange={(e) => onAllClasses(e.target.checked)}
          className="h-4 w-4 rounded border-white/10 accent-[var(--dn-creek-mid)]"
        />
        <span className="text-sm font-bold text-white">
          All supported classes
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
          ({supported.length} supported)
        </span>
      </label>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
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
                  onChange={() => onToggleClass(className)}
                  className="h-4 w-4 rounded border-white/10 accent-[var(--dn-creek-mid)] disabled:opacity-50"
                />
                <span className="font-mono">{className}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {subsetEmpty ? (
        <p
          className="mt-3 rounded-lg border border-[var(--dn-yellow)]/30 bg-[var(--dn-yellow-soft)] p-2.5 text-xs text-[var(--dn-yellow)]"
          role="status"
        >
          Check at least one class, or turn on “All supported classes”.
        </p>
      ) : null}
    </div>
  );
}

function ConfidenceControl({
  confidence,
  fallback,
  onChange,
}: {
  confidence: number | null;
  fallback: number;
  onChange: (value: number | null) => void;
}) {
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
        {confidence === null
          ? `Use the package default (${fallback.toFixed(2)}).`
          : `Detect objects at or above ${confidence.toFixed(2)} confidence.`}
      </span>
    </fieldset>
  );
}

function FpsControl({
  fps,
  fallback,
  onChange,
}: {
  fps: number | null;
  fallback: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        Target FPS
      </span>
      <select
        aria-label="Target FPS"
        value={fps ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
        className={clsx(SELECT_CLASS, "max-w-xs")}
      >
        <option value="">
          {fallback != null ? `Package default (${fallback})` : "Package default"}
        </option>
        {FPS_OPTIONS.map((n) => (
          <option key={n} value={n}>
            {n} FPS
          </option>
        ))}
      </select>
      <span className="text-xs text-[var(--dn-text-50)]">
        {fps === null
          ? "Use the package default frame rate."
          : `Process ${fps} frame${fps === 1 ? "" : "s"} per second.`}
      </span>
    </label>
  );
}
