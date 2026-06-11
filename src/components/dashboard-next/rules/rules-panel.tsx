"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellRing, Plus, Trash2 } from "lucide-react";
import {
  createRuleAction,
  deleteRuleAction,
  setRuleEnabledAction,
} from "@/app/dashboard/(app)/cameras/[cameraId]/configure/rules/actions";
import { RelativeTime } from "@/components/data/relative-time";
import type { Rule, RuleSeverity, RuleType } from "@/lib/api/types";
import {
  CLASS_FILTER_RULE_TYPES,
  DEFAULT_COOLDOWN_SECONDS,
  MIN_TIMER_COOLDOWN_SECONDS,
  TIMER_RULE_TYPES,
  RULE_SEVERITIES,
  RULE_TYPES,
  RULE_TYPE_TARGET,
  RULE_TYPE_TARGET_KEY,
  SCHEDULE_DAYS,
  type ScheduleDay,
  ruleConditionsLabel,
  ruleScheduleLabel,
  ruleTargetLabel,
  ruleTypeDescription,
  ruleTypeLabel,
  validateRuleConfig,
} from "@/lib/rules/rule-config-schema";

// Workflow Engine M1/M3 — the rule editor's brains. Owns the create-form
// state and drives the Server Actions; the server page passes the saved
// geometry shapes (targets picked by label, never typed by id) and the
// camera's detection-model classes (M3 class filter options). The
// persistence boundary: only {name, rule_type, config, severity,
// cooldown_seconds} is ever sent — selection/draft state stays here.
//
// M3 conditions appear only on rule types whose observation payloads can
// prove them (class/track → zone & dwell; count bounds → ROI occupancy;
// schedule → all). The shared validator enforces the same restriction.

const SELECT_CLASS =
  "rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition focus:border-[var(--dn-creek-mid)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const INPUT_CLASS =
  "rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition focus:border-[var(--dn-creek-mid)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";
const PRIMARY_BTN =
  "inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)] disabled:cursor-not-allowed disabled:opacity-50";
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-bold text-black/70 transition hover:border-[var(--dn-creek-mid)] hover:text-black disabled:cursor-not-allowed disabled:opacity-50";

const COOLDOWN_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Every match" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 3600, label: "1 hour" },
];

const SEVERITY_CHIP: Record<string, string> = {
  info: "bg-black/[0.06] text-black/70",
  warning: "bg-[#8a6d1f]/15 text-[#8a6d1f]",
  critical: "bg-red-700/10 text-red-700",
};

interface ShapeOption {
  id: string;
  label: string;
}

interface RulesPanelProps {
  cameraId: string;
  initialRules: Rule[];
  lines: ShapeOption[];
  rois: ShapeOption[];
  // Class names from the camera's configured detection model; empty when no
  // model is configured (the class filter falls back to free text).
  classOptions: string[];
  canEdit: boolean;
}

export function RulesPanel({
  cameraId,
  initialRules,
  lines,
  rois,
  classOptions,
  canEdit,
}: RulesPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState<RuleType>("line_crossing");
  // "" = any shape (no filter key in config).
  const [targetId, setTargetId] = useState("");
  const [minTotalCount, setMinTotalCount] = useState(1);
  const [minDurationSeconds, setMinDurationSeconds] = useState(60);
  const [severity, setSeverity] = useState<RuleSeverity>("warning");
  const [cooldown, setCooldown] = useState(DEFAULT_COOLDOWN_SECONDS);
  // --- M3 conditions ---------------------------------------------------
  // Empty selection / empty text = no class filter (match any class).
  const [selectedClasses, setSelectedClasses] = useState<Set<string>>(
    () => new Set(),
  );
  const [classText, setClassText] = useState("");
  const [requireTrackId, setRequireTrackId] = useState(false);
  // "" = no confidence floor (payload-enrichment unlock).
  const [minConfidence, setMinConfidence] = useState("");
  // "" = count all classes; otherwise the bounds apply to this class's
  // object-attributed count (payload-enrichment unlock).
  const [roiObjectClass, setRoiObjectClass] = useState("");
  // "" = no upper bound.
  const [maxTotalCount, setMaxTotalCount] = useState("");
  // M4 timer durations, in MINUTES in the UI (seconds on the wire).
  const [offlineForMinutes, setOfflineForMinutes] = useState(5);
  const [quietForMinutes, setQuietForMinutes] = useState(30);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDays, setScheduleDays] = useState<Set<ScheduleDay>>(
    () => new Set(["mon", "tue", "wed", "thu", "fri"]),
  );
  const [scheduleStart, setScheduleStart] = useState("08:00");
  const [scheduleEnd, setScheduleEnd] = useState("18:00");
  const [scheduleTz, setScheduleTz] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );

  const targetKind = RULE_TYPE_TARGET[ruleType];
  const targetOptions = targetKind === "line" ? lines : rois;
  const isTimerRule = TIMER_RULE_TYPES.has(ruleType);
  const supportsClassFilter = CLASS_FILTER_RULE_TYPES.has(ruleType);
  // no_detections_for filters by class too (which detections count as
  // activity) but has no track/confidence conditions.
  const showClassChips = supportsClassFilter || ruleType === "no_detections_for";

  const objectClasses = useMemo(() => {
    if (classOptions.length > 0) return [...selectedClasses];
    return [
      ...new Set(
        classText
          .split(",")
          .map((c) => c.trim())
          .filter((c) => c !== ""),
      ),
    ];
  }, [classOptions.length, selectedClasses, classText]);

  const config = useMemo(() => {
    const cfg: Record<string, unknown> = {};
    const targetKey = RULE_TYPE_TARGET_KEY[ruleType];
    if (targetId && targetKey) cfg[targetKey] = targetId;
    if (ruleType === "camera_offline") {
      cfg.offline_for_seconds = Math.max(1, offlineForMinutes) * 60;
    }
    if (ruleType === "no_detections_for") {
      cfg.quiet_for_seconds = Math.max(1, quietForMinutes) * 60;
      if (objectClasses.length > 0) cfg.object_classes = objectClasses;
    }
    if (ruleType === "roi_occupancy") {
      cfg.min_total_count = minTotalCount;
      const max = Number(maxTotalCount);
      if (maxTotalCount !== "" && Number.isInteger(max) && max >= 1) {
        cfg.max_total_count = max;
      }
      if (roiObjectClass.trim() !== "") {
        cfg.object_class = roiObjectClass.trim();
      }
    }
    if (ruleType === "dwell_exceeded" && minDurationSeconds > 0) {
      cfg.min_duration_seconds = minDurationSeconds;
    }
    if (supportsClassFilter) {
      if (objectClasses.length > 0) cfg.object_classes = objectClasses;
      if (requireTrackId) cfg.require_track_id = true;
      const conf = Number(minConfidence);
      if (minConfidence !== "" && conf > 0 && conf <= 1) {
        cfg.min_confidence = conf;
      }
    }
    if (scheduleEnabled) {
      cfg.schedule = {
        // Full week = no day filter on the wire.
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
    ruleType,
    targetId,
    minTotalCount,
    maxTotalCount,
    minDurationSeconds,
    offlineForMinutes,
    quietForMinutes,
    supportsClassFilter,
    objectClasses,
    requireTrackId,
    minConfidence,
    roiObjectClass,
    scheduleEnabled,
    scheduleDays,
    scheduleStart,
    scheduleEnd,
    scheduleTz,
  ]);

  function handleTypeChange(next: RuleType) {
    setRuleType(next);
    setTargetId(""); // a line id is meaningless for an ROI rule and vice versa
    if (!CLASS_FILTER_RULE_TYPES.has(next) && next !== "no_detections_for") {
      setSelectedClasses(new Set());
      setClassText("");
    }
    if (!CLASS_FILTER_RULE_TYPES.has(next)) {
      // Track/confidence conditions only exist where payloads prove them.
      setRequireTrackId(false);
      setMinConfidence("");
    }
    if (TIMER_RULE_TYPES.has(next) && cooldown < MIN_TIMER_COOLDOWN_SECONDS) {
      // Timer rules re-fire per cooldown; "every match" would fire every
      // evaluator tick.
      setCooldown(DEFAULT_COOLDOWN_SECONDS);
    }
    if (next !== "roi_occupancy") {
      setRoiObjectClass("");
    }
  }

  function toggleClass(label: string) {
    setSelectedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  function toggleDay(day: ScheduleDay) {
    setScheduleDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) {
        next.delete(day);
      } else {
        next.add(day);
      }
      return next;
    });
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Give the rule a name.");
      return;
    }
    const issues = validateRuleConfig(ruleType, config);
    if (issues.length > 0) {
      toast.error(issues[0].message);
      return;
    }
    const formData = new FormData();
    formData.set("camera_id", cameraId);
    formData.set("name", trimmed);
    formData.set("rule_type", ruleType);
    formData.set("severity", severity);
    formData.set("cooldown_seconds", String(cooldown));
    formData.set("config", JSON.stringify(config));
    startTransition(async () => {
      const result = await createRuleAction(formData);
      if (result.ok) {
        toast.success(result.message);
        setName("");
        setTargetId("");
        setSelectedClasses(new Set());
        setClassText("");
        setRequireTrackId(false);
        setMinConfidence("");
        setRoiObjectClass("");
        setMaxTotalCount("");
        setScheduleEnabled(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleToggle(rule: Rule) {
    const formData = new FormData();
    formData.set("camera_id", cameraId);
    formData.set("rule_id", rule.id);
    formData.set("enabled", String(!rule.enabled));
    startTransition(async () => {
      const result = await setRuleEnabledAction(formData);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function handleDelete(rule: Rule) {
    const formData = new FormData();
    formData.set("camera_id", cameraId);
    formData.set("rule_id", rule.id);
    startTransition(async () => {
      const result = await deleteRuleAction(formData);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {canEdit ? (
        <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            new rule
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
              Name
              <input
                type="text"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="Front door crossing"
                className={INPUT_CLASS + " w-52"}
                disabled={pending}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
              When
              <select
                value={ruleType}
                onChange={(e) => handleTypeChange(e.target.value as RuleType)}
                className={SELECT_CLASS}
                disabled={pending}
              >
                {RULE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ruleTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            {targetKind !== "camera" ? (
              <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                {targetKind === "line" ? "Line" : "Zone (ROI)"}
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className={SELECT_CLASS}
                  disabled={pending}
                >
                  <option value="">
                    Any {targetKind === "line" ? "line" : "zone"}
                  </option>
                  {targetOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label || s.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {ruleType === "camera_offline" ? (
              <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                Offline for (minutes)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={offlineForMinutes}
                  onChange={(e) =>
                    setOfflineForMinutes(
                      Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    )
                  }
                  className={INPUT_CLASS + " w-28"}
                  disabled={pending}
                />
              </label>
            ) : null}
            {ruleType === "no_detections_for" ? (
              <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                Quiet for (minutes)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={quietForMinutes}
                  onChange={(e) =>
                    setQuietForMinutes(
                      Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    )
                  }
                  className={INPUT_CLASS + " w-28"}
                  disabled={pending}
                />
              </label>
            ) : null}
            {ruleType === "roi_occupancy" ? (
              <>
                <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                  Min objects
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={minTotalCount}
                    onChange={(e) =>
                      setMinTotalCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))
                    }
                    className={INPUT_CLASS + " w-24"}
                    disabled={pending}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                  Max objects
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={maxTotalCount}
                    onChange={(e) => setMaxTotalCount(e.target.value)}
                    placeholder="none"
                    className={INPUT_CLASS + " w-24"}
                    disabled={pending}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                  Count class
                  {classOptions.length > 0 ? (
                    <select
                      value={roiObjectClass}
                      onChange={(e) => setRoiObjectClass(e.target.value)}
                      className={SELECT_CLASS}
                      disabled={pending}
                    >
                      <option value="">All classes</option>
                      {classOptions.map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={roiObjectClass}
                      onChange={(e) => setRoiObjectClass(e.target.value)}
                      placeholder="all classes"
                      className={INPUT_CLASS + " w-32"}
                      disabled={pending}
                    />
                  )}
                </label>
              </>
            ) : null}
            {ruleType === "dwell_exceeded" ? (
              <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                Min dwell (s)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={minDurationSeconds}
                  onChange={(e) =>
                    setMinDurationSeconds(
                      Math.max(1, Math.floor(Number(e.target.value) || 1)),
                    )
                  }
                  className={INPUT_CLASS + " w-24"}
                  disabled={pending}
                />
              </label>
            ) : null}
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
              Cooldown
              <select
                value={cooldown}
                onChange={(e) => setCooldown(Number(e.target.value))}
                className={SELECT_CLASS}
                disabled={pending}
              >
                {COOLDOWN_OPTIONS.filter(
                  (o) => !isTimerRule || o.value >= MIN_TIMER_COOLDOWN_SECONDS,
                ).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleCreate}
              className={PRIMARY_BTN}
              disabled={pending}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Create rule
            </button>
          </div>

          {/* M3 conditions — only the inputs this rule type's observation
              payloads can actually prove. */}
          {showClassChips ? (
            <div className="mt-4 border-t border-black/10 pt-3">
              <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
                conditions
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {classOptions.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-bold text-black/70">
                      Object classes:
                    </span>
                    {classOptions.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => toggleClass(label)}
                        className={
                          "rounded-full border px-2.5 py-1 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 " +
                          (selectedClasses.has(label)
                            ? "border-[var(--dn-creek-mid)] bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]"
                            : "border-black/10 bg-white text-black/60 hover:border-[var(--dn-creek-mid)] hover:text-black")
                        }
                        disabled={pending}
                      >
                        {label}
                      </button>
                    ))}
                    <span className="text-xs text-[var(--dn-text-50)]">
                      (none selected = any class)
                    </span>
                  </div>
                ) : (
                  <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                    Object classes (comma-separated, blank = any)
                    <input
                      type="text"
                      value={classText}
                      onChange={(e) => setClassText(e.target.value)}
                      placeholder="person, forklift"
                      className={INPUT_CLASS + " w-64"}
                      disabled={pending}
                    />
                  </label>
                )}
                {supportsClassFilter ? (
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-black/70">
                    <input
                      type="checkbox"
                      checked={requireTrackId}
                      onChange={(e) => setRequireTrackId(e.target.checked)}
                      disabled={pending}
                    />
                    Require tracked object
                  </label>
                ) : null}
                {supportsClassFilter ? (
                  <label className="flex flex-col gap-1 text-xs font-bold text-black/70">
                    Min confidence (0–1, blank = any)
                    <input
                      type="number"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={minConfidence}
                      onChange={(e) => setMinConfidence(e.target.value)}
                      placeholder="0.70"
                      className={INPUT_CLASS + " w-28"}
                      disabled={pending}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="mt-4 border-t border-black/10 pt-3">
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
                      onClick={() => toggleDay(day)}
                      className={
                        "rounded-full border px-2.5 py-1 text-xs font-bold capitalize transition disabled:cursor-not-allowed disabled:opacity-50 " +
                        (scheduleDays.has(day)
                          ? "border-[var(--dn-creek-mid)] bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]"
                          : "border-black/10 bg-white text-black/60 hover:border-[var(--dn-creek-mid)] hover:text-black")
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
                <span className="pb-1.5 text-xs text-[var(--dn-text-50)]">
                  End before start wraps past midnight.
                </span>
              </div>
            ) : null}
          </div>

          <p className="mt-2 text-xs text-[var(--dn-text-50)]">
            {ruleTypeDescription(ruleType)}
          </p>
        </div>
      ) : (
        <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
          <p className="text-sm text-[var(--dn-text-50)]">
            You have viewer access — rules are read-only. An owner or admin
            can create and edit rules.
          </p>
        </div>
      )}

      {initialRules.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <BellRing
            className="mx-auto h-8 w-8 text-[var(--dn-text-50)]"
            aria-hidden
          />
          <h3 className="mt-4 font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">
            No rules yet
          </h3>
          <p className="mx-auto mt-3 max-w-prose text-sm text-[var(--dn-text-50)]">
            Draw lines and ROIs in the geometry editor, then create a rule
            here to get an alert when something crosses or lingers.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {initialRules.map((rule) => (
            <li
              key={rule.id}
              className="dn-tile flex flex-wrap items-center gap-3 p-[clamp(0.9rem,1.4vw,1.2rem)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-black">{rule.name}</span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
                      (SEVERITY_CHIP[rule.severity] ?? SEVERITY_CHIP.info)
                    }
                  >
                    {rule.severity}
                  </span>
                  {!rule.enabled ? (
                    <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black/50">
                      disabled
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--dn-text-50)]">
                  {ruleTypeLabel(rule.rule_type)} · {ruleTargetLabel(rule)}
                  {ruleConditionsLabel(rule)
                    ? ` · ${ruleConditionsLabel(rule)}`
                    : ""}
                  {ruleScheduleLabel(rule) ? ` · ${ruleScheduleLabel(rule)}` : ""}
                  {rule.cooldown_seconds > 0
                    ? ` · cooldown ${rule.cooldown_seconds}s`
                    : " · fires on every match"}
                </p>
                <p className="mt-0.5 text-xs font-mono text-[var(--dn-text-50)]">
                  created <RelativeTime value={rule.created_at} />
                </p>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggle(rule)}
                    className={GHOST_BTN}
                    disabled={pending}
                  >
                    {rule.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(rule)}
                    className={GHOST_BTN + " hover:border-red-700/40 hover:text-red-700"}
                    disabled={pending}
                    aria-label={`Delete rule ${rule.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
