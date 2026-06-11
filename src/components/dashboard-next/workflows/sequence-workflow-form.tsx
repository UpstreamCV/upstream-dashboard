"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, Plus } from "lucide-react";
import { createWorkflowAction } from "@/app/dashboard/(app)/workflows/actions";
import type { RuleSeverity } from "@/lib/api/types";
import {
  RULE_SEVERITIES,
  SCHEDULE_DAYS,
  type ScheduleDay,
} from "@/lib/rules/rule-config-schema";
import {
  SEQUENCE_EVENT_TYPES,
  STEP_TARGET_KEY,
  STEP_TARGET_KIND,
  type SequenceEventType,
  TRACK_ATTRIBUTING_EVENT_TYPES,
  sequenceEventLabel,
  validateSequenceConfig,
} from "@/lib/workflows/sequence-config-schema";

// Workflow Engine M5 — the form-based sequence builder (deliberately NOT a
// visual node editor). Two fixed steps: a start event and a follow-up event
// with a time window. The persistence boundary: only {name, config,
// severity, cooldown_seconds} crosses the wire; all picker state stays here.

const SELECT_CLASS =
  "rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition focus:border-[var(--dn-creek-mid)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_CLASS =
  "rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition focus:border-[var(--dn-creek-mid)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50";
const CHIP_ON =
  "rounded-full border px-2.5 py-1 text-xs font-bold transition border-[var(--dn-creek-mid)] bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]";
const CHIP_OFF =
  "rounded-full border px-2.5 py-1 text-xs font-bold transition border-black/10 bg-white text-black/60 hover:border-[var(--dn-creek-mid)] hover:text-black";

const COOLDOWN_OPTIONS = [
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 3600, label: "1 hour" },
];

interface ShapeOption {
  id: string;
  label: string;
}

interface StepState {
  eventType: SequenceEventType;
  targetId: string; // "" = any shape
  classes: Set<string>;
  minConfidence: string; // "" = none
}

interface SequenceWorkflowFormProps {
  cameraId: string;
  lines: ShapeOption[];
  rois: ShapeOption[];
  classOptions: string[];
}

function stepConditions(step: StepState): Record<string, unknown> {
  const conditions: Record<string, unknown> = {};
  if (step.targetId) conditions[STEP_TARGET_KEY[step.eventType]] = step.targetId;
  if (step.classes.size > 0 && step.eventType !== "processor.line_crossing") {
    conditions.object_classes = [...step.classes];
  }
  const conf = Number(step.minConfidence);
  if (
    step.minConfidence !== "" &&
    conf > 0 &&
    conf <= 1 &&
    step.eventType !== "processor.line_crossing"
  ) {
    conditions.min_confidence = conf;
  }
  return conditions;
}

export function SequenceWorkflowForm({
  cameraId,
  lines,
  rois,
  classOptions,
}: SequenceWorkflowFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [start, setStart] = useState<StepState>({
    eventType: "processor.zone_entered",
    targetId: "",
    classes: new Set(),
    minConfidence: "",
  });
  const [follow, setFollow] = useState<StepState>({
    eventType: "processor.line_crossing_object",
    targetId: "",
    classes: new Set(),
    minConfidence: "",
  });
  const [withinSeconds, setWithinSeconds] = useState(30);
  const [sameTrack, setSameTrack] = useState(true);
  const [timeoutAlert, setTimeoutAlert] = useState(true);
  const [timeoutMessage, setTimeoutMessage] = useState("");
  const [severity, setSeverity] = useState<RuleSeverity>("warning");
  const [cooldown, setCooldown] = useState(300);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<Set<ScheduleDay>>(
    () => new Set(["mon", "tue", "wed", "thu", "fri"]),
  );
  const [scheduleStart, setScheduleStart] = useState("08:00");
  const [scheduleEnd, setScheduleEnd] = useState("18:00");
  const [scheduleTz, setScheduleTz] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );

  const sameTrackPossible =
    TRACK_ATTRIBUTING_EVENT_TYPES.has(start.eventType) &&
    TRACK_ATTRIBUTING_EVENT_TYPES.has(follow.eventType);

  const config = useMemo(() => {
    const cfg: Record<string, unknown> = {
      start: {
        event_type: start.eventType,
        ...(Object.keys(stepConditions(start)).length > 0
          ? { conditions: stepConditions(start) }
          : {}),
      },
      then: {
        within_seconds: Math.max(5, withinSeconds),
        event_type: follow.eventType,
        ...(Object.keys(stepConditions(follow)).length > 0
          ? { conditions: stepConditions(follow) }
          : {}),
      },
      on_timeout: {
        create_alert: timeoutAlert,
        ...(timeoutAlert && timeoutMessage.trim()
          ? { alert_message: timeoutMessage.trim() }
          : {}),
      },
    };
    if (sameTrack && sameTrackPossible) {
      cfg.correlation = { same_track_id: true };
    }
    if (scheduleEnabled) {
      cfg.schedule = {
        ...(scheduleDays.size > 0 && scheduleDays.size < 7
          ? { days: SCHEDULE_DAYS.filter((d) => scheduleDays.has(d)) }
          : {}),
        start_time: scheduleStart,
        end_time: scheduleEnd,
        timezone: scheduleTz.trim(),
      };
    }
    return cfg;
  }, [
    start,
    follow,
    withinSeconds,
    sameTrack,
    sameTrackPossible,
    timeoutAlert,
    timeoutMessage,
    scheduleEnabled,
    scheduleDays,
    scheduleStart,
    scheduleEnd,
    scheduleTz,
  ]);

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the workflow a name.");
      return;
    }
    const issues = validateSequenceConfig(config);
    if (issues.length > 0) {
      toast.error(issues[0].message);
      return;
    }
    const formData = new FormData();
    formData.set("camera_id", cameraId);
    formData.set("name", trimmed);
    formData.set("severity", severity);
    formData.set("cooldown_seconds", String(cooldown));
    formData.set("config", JSON.stringify(config));
    startTransition(async () => {
      const result = await createWorkflowAction(formData);
      if (result.ok) {
        toast.success(result.message);
        router.push("/dashboard/workflows");
      } else {
        toast.error(result.message);
      }
    });
  }

  function stepEditor(
    label: string,
    step: StepState,
    setStep: (next: StepState) => void,
  ) {
    const kind = STEP_TARGET_KIND[step.eventType];
    const options = kind === "line" ? lines : rois;
    const supportsConditions = step.eventType !== "processor.line_crossing";
    return (
      <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          {label}
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
            Event
            <select
              value={step.eventType}
              onChange={(e) =>
                setStep({
                  ...step,
                  eventType: e.target.value as SequenceEventType,
                  targetId: "",
                })
              }
              className={SELECT_CLASS}
              disabled={pending}
            >
              {SEQUENCE_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {sequenceEventLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
            {kind === "line" ? "Line" : "Zone (ROI)"}
            <select
              value={step.targetId}
              onChange={(e) => setStep({ ...step, targetId: e.target.value })}
              className={SELECT_CLASS}
              disabled={pending}
            >
              <option value="">Any {kind === "line" ? "line" : "zone"}</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label || s.id}
                </option>
              ))}
            </select>
          </label>
          {supportsConditions ? (
            <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
              Min confidence (blank = any)
              <input
                type="number"
                min={0.05}
                max={1}
                step={0.05}
                value={step.minConfidence}
                onChange={(e) => setStep({ ...step, minConfidence: e.target.value })}
                placeholder="0.70"
                className={INPUT_CLASS + " w-28"}
                disabled={pending}
              />
            </label>
          ) : null}
        </div>
        {supportsConditions && classOptions.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-black/70">Classes:</span>
            {classOptions.map((label2) => (
              <button
                key={label2}
                type="button"
                onClick={() => {
                  const next = new Set(step.classes);
                  if (next.has(label2)) {
                    next.delete(label2);
                  } else {
                    next.add(label2);
                  }
                  setStep({ ...step, classes: next });
                }}
                className={step.classes.has(label2) ? CHIP_ON : CHIP_OFF}
                disabled={pending}
              >
                {label2}
              </button>
            ))}
            <span className="text-xs text-[var(--dn-text-50)]">(none = any)</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-4">
      <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
        Name
        <input
          type="text"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder="Dock arrival check"
          className={INPUT_CLASS + " w-72"}
          disabled={pending}
        />
      </label>

      {stepEditor("Step 1 — when this happens", start, setStart)}

      <div className="flex items-center gap-3 pl-2">
        <ArrowDown className="h-4 w-4 text-[var(--dn-text-50)]" aria-hidden />
        <label className="flex items-center gap-2 text-xs font-bold text-black/70">
          within
          <input
            type="number"
            min={5}
            max={86400}
            step={1}
            value={withinSeconds}
            onChange={(e) =>
              setWithinSeconds(Math.max(5, Math.floor(Number(e.target.value) || 5)))
            }
            className={INPUT_CLASS + " w-24"}
            disabled={pending}
          />
          seconds
        </label>
        <label
          className="inline-flex items-center gap-2 text-xs font-bold text-black/70"
          title={
            sameTrackPossible
              ? "Both events must come from the same tracked object."
              : "Both step events must carry track IDs to correlate by object."
          }
        >
          <input
            type="checkbox"
            checked={sameTrack && sameTrackPossible}
            onChange={(e) => setSameTrack(e.target.checked)}
            disabled={pending || !sameTrackPossible}
          />
          Same tracked object
        </label>
      </div>

      {stepEditor("Step 2 — expect this follow-up", follow, setFollow)}

      <div className="rounded-xl border border-black/10 bg-black/[0.02] p-3">
        <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          on timeout
        </p>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-bold text-black/70">
            <input
              type="checkbox"
              checked={timeoutAlert}
              onChange={(e) => setTimeoutAlert(e.target.checked)}
              disabled={pending}
            />
            Create an alert when the follow-up doesn&rsquo;t happen in time
          </label>
          {timeoutAlert ? (
            <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
              Alert message (optional)
              <input
                type="text"
                value={timeoutMessage}
                maxLength={200}
                onChange={(e) => setTimeoutMessage(e.target.value)}
                placeholder="Expected follow-up event did not happen in time."
                className={INPUT_CLASS + " w-96"}
                disabled={pending}
              />
            </label>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
          Severity
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as RuleSeverity)}
            className={SELECT_CLASS}
            disabled={pending}
          >
            {RULE_SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
          Alert cooldown
          <select
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
            className={SELECT_CLASS}
            disabled={pending}
          >
            {COOLDOWN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-black/70">
          <input
            type="checkbox"
            checked={scheduleEnabled}
            onChange={(e) => setScheduleEnabled(e.target.checked)}
            disabled={pending}
          />
          Only during a time window
        </label>
        {scheduleEnabled ? (
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {SCHEDULE_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setScheduleDays((prev) => {
                      const next = new Set(prev);
                      if (next.has(day)) {
                        next.delete(day);
                      } else {
                        next.add(day);
                      }
                      return next;
                    });
                  }}
                  className={
                    (scheduleDays.has(day) ? CHIP_ON : CHIP_OFF) + " capitalize"
                  }
                  disabled={pending}
                >
                  {day}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
              From
              <input
                type="time"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
                className={INPUT_CLASS}
                disabled={pending}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
              To
              <input
                type="time"
                value={scheduleEnd}
                onChange={(e) => setScheduleEnd(e.target.value)}
                className={INPUT_CLASS}
                disabled={pending}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
              Timezone (IANA)
              <input
                type="text"
                value={scheduleTz}
                onChange={(e) => setScheduleTz(e.target.value)}
                className={INPUT_CLASS + " w-52"}
                disabled={pending}
              />
            </label>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleCreate}
        className={PRIMARY_BTN}
        disabled={pending}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Create workflow
      </button>
    </div>
  );
}
