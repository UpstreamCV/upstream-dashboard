"use client";

import type { TrackerOption } from "@/lib/perception/advanced-resolution";

// P5-L — tracker picker. Most models offer a single tracker (IOU), so we render
// a clear disabled single-value field in that case; only yolox_s offers a real
// choice (IOU + NvDCF), rendered as a styled native select. A short hint per
// tracker explains the trade-off.

const TRACKER_HINTS: Record<string, string> = {
  deepstream_iou_fast_v1: "Fast IOU association — low compute; the verified default.",
  deepstream_nvdcf_balanced_v1:
    "NvDCF visual tracker — higher compute; experimental for people analytics.",
  deepstream_nvsort_fast_v1: "NvSORT — planned; not runnable yet.",
};

export function TrackerPicker({
  trackers,
  selected,
  onSelect,
}: {
  trackers: TrackerOption[];
  selected: string | null;
  onSelect: (profileId: string) => void;
}) {
  const single = trackers.length <= 1;
  const current = trackers.find((t) => t.profileId === selected) ?? trackers[0] ?? null;
  const hint = current ? TRACKER_HINTS[current.profileId] : null;

  return (
    <div className="space-y-1">
      <label className="font-mono text-[11px] uppercase tracking-wider text-[var(--dn-text-50)]">
        Tracker
      </label>
      {single ? (
        <div
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[var(--dn-text-70)]"
          aria-disabled
        >
          <span>{current?.label ?? "—"}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--dn-text-40)]">
            only option
          </span>
        </div>
      ) : (
        <select
          aria-label="Tracker"
          value={selected ?? current?.profileId ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-sm text-white transition focus:border-[var(--dn-creek-mid)] focus:outline-none"
        >
          {trackers.map((t) => (
            <option key={t.profileId} value={t.profileId}>
              {t.label}
            </option>
          ))}
        </select>
      )}
      {hint ? <p className="text-xs text-[var(--dn-text-50)]">{hint}</p> : null}
    </div>
  );
}
