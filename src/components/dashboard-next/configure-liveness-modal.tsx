"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSourceLivenessAction } from "@/app/(dash)/(app)/(fleet)/agents/collector/actions";
import type { ReliabilitySource, UpdateSourceLivenessInput } from "@/lib/api/types";
import {
  HEALTH_LABEL,
  KIND_LABEL,
  UNIT_SECONDS,
  type DurationUnit,
  healthExplanation,
  secondsToUnit,
} from "./collector-health";

// M2c — per-source "Configure liveness" modal. Controlled by the Sources table
// (open/onOpenChange). Sends ONLY the fields the user changed: M2b's PATCH
// re-baselines health_status='unknown' whenever liveness_enabled is provided, so
// blindly resending it would flip a healthy source to Unknown every save. An
// explicit null interval resets it to the per-kind default. These are external
// collector/CV sources — never "camera/pipeline/processor" wording.

const NUM_CLASS =
  "w-24 rounded-xl bg-white/[0.06] border border-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition disabled:opacity-40 disabled:cursor-not-allowed";
const SELECT_CLASS =
  "rounded-xl bg-white/[0.06] border border-white/15 px-2.5 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition disabled:opacity-40 disabled:cursor-not-allowed";
const FIELD_LABEL =
  "text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]";

const MAX_SECONDS = 30 * 24 * 60 * 60; // 30 days

function parseValue(raw: string): number {
  return raw.trim() === "" ? Number.NaN : Number(raw);
}

export function ConfigureLivenessModal({
  source,
  open,
  onOpenChange,
  onConfigured,
}: {
  source: ReliabilitySource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfigured: () => void;
}) {
  const isCollector = source.source_kind === "collector";
  const initialExpected = secondsToUnit(source.expected_interval_seconds);
  const initialGrace = secondsToUnit(source.liveness_grace_seconds);

  const [enabled, setEnabled] = useState(source.liveness_enabled);
  const [expectedValue, setExpectedValue] = useState(String(initialExpected.value));
  const [expectedUnit, setExpectedUnit] = useState<DurationUnit>(initialExpected.unit);
  const [graceValue, setGraceValue] = useState(String(initialGrace.value));
  const [graceUnit, setGraceUnit] = useState<DurationUnit>(initialGrace.unit);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const expectedSec = parseValue(expectedValue) * UNIT_SECONDS[expectedUnit];
  const graceSec = parseValue(graceValue) * UNIT_SECONDS[graceUnit];

  function intervalError(): string | null {
    if (!enabled) return null; // intervals don't apply while monitoring is off
    if (!Number.isInteger(expectedSec) || expectedSec <= 0) {
      return "Expected interval must be a whole number greater than 0.";
    }
    if (!Number.isInteger(graceSec) || graceSec < 0) {
      return "Grace period must be a whole number of 0 or more.";
    }
    if (expectedSec > MAX_SECONDS || graceSec > MAX_SECONDS) {
      return "Interval is too large (max 30 days).";
    }
    return null;
  }

  const enabledDirty = enabled !== source.liveness_enabled;
  const expectedDirty = enabled && expectedSec !== source.expected_interval_seconds;
  const graceDirty = enabled && graceSec !== source.liveness_grace_seconds;
  const hasChanges = enabledDirty || expectedDirty || graceDirty;
  const canSave = hasChanges && intervalError() === null && !pending;

  function submit(input: UpdateSourceLivenessInput) {
    setError(null);
    startTransition(async () => {
      const result = await updateSourceLivenessAction(source.id, input);
      if (result.ok) {
        toast.success("Liveness settings saved.");
        onConfigured();
        onOpenChange(false);
      } else {
        setError(result.message);
      }
    });
  }

  function save() {
    const err = intervalError();
    if (err) {
      setError(err);
      return;
    }
    const input: UpdateSourceLivenessInput = {};
    if (enabledDirty) input.liveness_enabled = enabled;
    if (expectedDirty) input.expected_interval_seconds = expectedSec;
    if (graceDirty) input.liveness_grace_seconds = graceSec;
    submit(input);
  }

  function resetToDefaults() {
    // Reset only the intervals (per the contract); leave monitoring as-is.
    submit({ expected_interval_seconds: null, liveness_grace_seconds: null });
  }

  const expectedLabel = isCollector
    ? "Expected heartbeat every"
    : "Expected observations every";
  const graceLabel = isCollector
    ? "Grace period before marking collector offline"
    : "Grace period before marking source silent";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <div className="dashboard-next">
          <Dialog.Overlay className="fixed inset-0 bg-[rgba(20,32,18,0.55)] backdrop-blur-sm z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(520px,calc(100vw-2rem))] dn-tile p-6 text-white">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <Dialog.Title className="font-bold text-[clamp(1.1rem,1.6vw,1.4rem)] leading-tight">
                  Configure liveness
                </Dialog.Title>
                <Dialog.Description className="text-sm text-[var(--dn-text-50)] mt-1">
                  Monitoring for an external collector/CV source — not a managed
                  Upstream camera.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  aria-label="Close"
                  className="rounded-full p-1.5 text-[var(--dn-text-50)] hover:text-white hover:bg-white/[0.08] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </Dialog.Close>
            </div>

            <dl className="mb-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-[var(--dn-text-50)]">Source</dt>
              <dd className="font-bold">{source.source}</dd>
              {!isCollector ? (
                <>
                  <dt className="text-[var(--dn-text-50)]">External key</dt>
                  <dd>{source.external_camera_key ?? "—"}</dd>
                </>
              ) : null}
              <dt className="text-[var(--dn-text-50)]">Kind</dt>
              <dd>{KIND_LABEL[source.source_kind]}</dd>
              <dt className="text-[var(--dn-text-50)]">Current health</dt>
              <dd>
                {HEALTH_LABEL[source.health_status]} — {healthExplanation(source)}
              </dd>
            </dl>

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  aria-label="Monitor this source"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="accent-[var(--dn-creek-mid)] w-3.5 h-3.5"
                />
                Monitor this source
              </label>

              <div className="space-y-1.5">
                <span className={FIELD_LABEL}>{expectedLabel}</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    aria-label="Expected interval value"
                    value={expectedValue}
                    disabled={!enabled}
                    onChange={(e) => setExpectedValue(e.target.value)}
                    className={NUM_CLASS}
                  />
                  <select
                    aria-label="Expected interval unit"
                    value={expectedUnit}
                    disabled={!enabled}
                    onChange={(e) => setExpectedUnit(e.target.value as DurationUnit)}
                    className={SELECT_CLASS}
                  >
                    <option value="seconds">seconds</option>
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className={FIELD_LABEL}>{graceLabel}</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    aria-label="Grace period value"
                    value={graceValue}
                    disabled={!enabled}
                    onChange={(e) => setGraceValue(e.target.value)}
                    className={NUM_CLASS}
                  />
                  <select
                    aria-label="Grace period unit"
                    value={graceUnit}
                    disabled={!enabled}
                    onChange={(e) => setGraceUnit(e.target.value as DurationUnit)}
                    className={SELECT_CLASS}
                  >
                    <option value="seconds">seconds</option>
                    <option value="minutes">minutes</option>
                    <option value="hours">hours</option>
                  </select>
                </div>
                <p className="text-[11px] text-[var(--dn-text-50)]">
                  Leave defaults with “Reset to defaults”.
                </p>
              </div>

              {error ? (
                <p className="text-sm text-[#c0473b]">{error}</p>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={resetToDefaults}
                  disabled={pending}
                  className="rounded-full bg-white/[0.05] border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/[0.08] transition disabled:opacity-60"
                >
                  Reset to defaults
                </button>
                <div className="flex gap-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-full bg-white/[0.05] border border-white/10 px-4 py-2 text-sm text-white hover:bg-white/[0.08] transition"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="button"
                    onClick={save}
                    disabled={!canSave}
                    className="rounded-full bg-[var(--dn-creek-mid)] text-white font-bold px-4 py-2 text-sm transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
