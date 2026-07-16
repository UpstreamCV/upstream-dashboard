// P5-L — Advanced (model + tracker) resolution. Pure + unit-tested (no React,
// no I/O), so it's importable from the Processing panel and node-env vitest.
//
// Advanced mode is a presentation layer over the existing gated package
// catalog: the operator picks a MODEL and a TRACKER, and we resolve that pair
// to an existing `package_id` (reusing the package request/apply flow + the
// first-party gate — no backend contract change). The model list is DERIVED
// from the catalog the page already fetches, so it inherits the gate for free
// (BYOM models only appear when their packages are visible).

import type { ModelMetrics, ProcessingPackage } from "@/lib/api/types";

// The full analytics-trigger set. The CANONICAL package for a (model, tracker)
// pair is the full-chain one offering all of these (not a narrowed use-case
// variant); ties break by catalog declaration order (the base package is
// declared before its variants), so this needs no hardcoded id allowlist.
const FULL_TRIGGERS = [
  "line_crossing",
  "roi_occupancy",
  "zone_entered",
  "zone_exited",
  "dwell_exceeded",
];

// Synthetic tracker id for self-contained (bundled) packages — the whole
// detect→track→analytics chain ships inside the runtime container, so there is
// no real tracker profile to pick. Client-side only: the save path sends the
// resolved package_id, never this sentinel.
export const BUNDLED_TRACKER = "__bundled__";

// The catalog carries only ids; these small maps give friendly labels (same
// posture as the rest of the UI — ids are stable and few; unknowns fall back to
// a prettified id).
const MODEL_LABELS: Record<string, string> = {
  trafficcamnet_v1: "TrafficCamNet",
  yolox_s_v1: "YOLOX-S",
  yolox_nano_v1: "YOLOX-Nano",
  yolox_tiny_v1: "YOLOX-Tiny",
  yolox_m_v1: "YOLOX-M",
  yolo11n_v1: "YOLO11-N",
  yolo11s_v1: "YOLO11-S",
  yolo11m_v1: "YOLO11-M",
  yolov8n_v1: "YOLOv8-N",
  peoplenet_v1: "PeopleNet",
};

const TRACKER_LABELS: Record<string, string> = {
  deepstream_iou_fast_v1: "IOU (fast)",
  deepstream_nvdcf_balanced_v1: "NvDCF (balanced)",
  deepstream_nvsort_fast_v1: "NvSORT",
  [BUNDLED_TRACKER]: "Built-in (bundled)",
};

function prettifyId(id: string): string {
  return id
    .replace(/_v\d+$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function modelLabel(modelId: string): string {
  return MODEL_LABELS[modelId] ?? prettifyId(modelId);
}

export function trackerLabel(profileId: string | null): string {
  if (!profileId) return "—";
  return TRACKER_LABELS[profileId] ?? prettifyId(profileId);
}

/** A selectable tracker for a model (a profile id + its friendly label). */
export interface TrackerOption {
  profileId: string;
  label: string;
}

/** A selectable detection model, derived from the (gated) catalog. */
export interface ModelOption {
  modelId: string;
  label: string;
  /** Published reference metrics for the model (null if none). */
  metrics: ModelMetrics | null;
  /** false when the backing model is BYOM/restrictive (AGPL) — UI badges it. */
  firstParty: boolean;
  /** Distinct trackers available for this model. */
  trackers: TrackerOption[];
  /** Any one analytics package for this model (for badges/status hints). */
  representative: ProcessingPackage;
}

// An "analytics" package is one with a real backing model + analytics profile
// (people/vehicle). Diagnostic probes (no model / no analytics / no triggers)
// and the mock detector are excluded from the Advanced model list.
function isAdvancedModelPackage(p: ProcessingPackage): boolean {
  return Boolean(p.model_id) && p.runtime !== "mock" && Boolean(p.analytics_profile_id);
}

// A self-contained (bundled) package: no model/analytics ids to compose, but
// real analytics capability (declared triggers). It appears in the Advanced
// picker as its own entry keyed by package_id, with one synthetic "Built-in"
// tracker. Probes stay out — they declare no triggers.
function isBundledPackage(p: ProcessingPackage): boolean {
  return (
    !p.model_id &&
    !p.analytics_profile_id &&
    p.runtime !== "mock" &&
    p.supported_triggers.length > 0
  );
}

const BUNDLED_TRACKER_OPTION: TrackerOption = {
  profileId: BUNDLED_TRACKER,
  label: TRACKER_LABELS[BUNDLED_TRACKER],
};

/** Distinct detection models across the (gated) catalog, in catalog order. */
export function modelsFromCatalog(packages: ProcessingPackage[]): ModelOption[] {
  const order: string[] = [];
  const byModel = new Map<string, ProcessingPackage[]>();
  const bundled = new Map<string, ProcessingPackage>();
  for (const p of packages) {
    if (isBundledPackage(p)) {
      if (!bundled.has(p.package_id)) {
        bundled.set(p.package_id, p);
        order.push(p.package_id);
      }
      continue;
    }
    if (!isAdvancedModelPackage(p)) continue;
    const modelId = p.model_id as string;
    if (!byModel.has(modelId)) {
      byModel.set(modelId, []);
      order.push(modelId);
    }
    byModel.get(modelId)!.push(p);
  }
  return order.map((key) => {
    const self = bundled.get(key);
    if (self) {
      return {
        modelId: self.package_id,
        label: self.display_name,
        metrics: self.model_metrics,
        firstParty: self.first_party,
        trackers: [BUNDLED_TRACKER_OPTION],
        representative: self,
      };
    }
    const pkgs = byModel.get(key)!;
    return {
      modelId: key,
      label: modelLabel(key),
      metrics: pkgs.find((p) => p.model_metrics)?.model_metrics ?? null,
      firstParty: pkgs.every((p) => p.first_party),
      trackers: trackersForModel(packages, key),
      representative: pkgs[0],
    };
  });
}

/** Distinct trackers for a model, in catalog order (≥1; one for most models). */
export function trackersForModel(
  packages: ProcessingPackage[],
  modelId: string,
): TrackerOption[] {
  if (packages.some((p) => p.package_id === modelId && isBundledPackage(p))) {
    return [BUNDLED_TRACKER_OPTION];
  }
  const seen = new Set<string>();
  const out: TrackerOption[] = [];
  for (const p of packages) {
    if (p.model_id !== modelId || !p.analytics_profile_id || !p.tracker_profile_id) continue;
    if (seen.has(p.tracker_profile_id)) continue;
    seen.add(p.tracker_profile_id);
    out.push({ profileId: p.tracker_profile_id, label: trackerLabel(p.tracker_profile_id) });
  }
  return out;
}

function statusRank(status: ProcessingPackage["status"]): number {
  return status === "supported" ? 3 : status === "probe" ? 2 : status === "experimental" ? 1 : 0;
}

/**
 * Resolve a (model, tracker) selection to the canonical catalog package: the
 * full-chain package (all analytics triggers), preferring better status; ties
 * break by catalog declaration order (a stable sort), so the generic/base
 * package — declared before its use-case variants — wins. The narrowed
 * use-case variants (fast/occupancy/dwell/…) stay in Guided. Returns null if
 * no package matches the pair.
 */
export function resolveCanonicalPackage(
  packages: ProcessingPackage[],
  modelId: string,
  trackerProfileId: string,
): ProcessingPackage | null {
  const self = packages.find((p) => p.package_id === modelId && isBundledPackage(p));
  if (self) return self;
  const matches = packages
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        p.model_id === modelId &&
        p.tracker_profile_id === trackerProfileId &&
        Boolean(p.analytics_profile_id),
    );
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const aFull = FULL_TRIGGERS.every((t) => a.p.supported_triggers.includes(t)) ? 1 : 0;
    const bFull = FULL_TRIGGERS.every((t) => b.p.supported_triggers.includes(t)) ? 1 : 0;
    if (aFull !== bFull) return bFull - aFull;
    const s = statusRank(b.p.status) - statusRank(a.p.status);
    if (s !== 0) return s;
    return a.i - b.i; // catalog order — base package precedes its variants
  });
  return matches[0].p;
}

/** Format a metric number for display, or "—" when null. */
export function formatMetric(value: number | null | undefined, suffix = ""): string {
  return value == null ? "—" : `${value}${suffix}`;
}
