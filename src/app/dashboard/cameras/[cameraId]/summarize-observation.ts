// Pure helpers for the Recent Observations panel — no React, no I/O, so they
// stay importable from both the client panel and node-environment vitest.

import type { ObservationRecord, ObservationType } from "@/lib/api/types";

/** Initial row count the panel and the page's server fetch agree on. */
export const DEFAULT_OBSERVATION_LIMIT = 25;

/** Row counts offered by the limit selector. */
export const OBSERVATION_LIMITS: readonly number[] = [25, 50, 100];

/** The seven known processor observation types — the filter dropdown options. */
export const OBSERVATION_TYPES: readonly ObservationType[] = [
  "processor.line_crossing",
  "processor.roi_occupancy",
  "processor.zone_entered",
  "processor.zone_exited",
  "processor.dwell_started",
  "processor.dwell_updated",
  "processor.dwell_exceeded",
];

/**
 * Build the proxy-relative path for the recent-observations endpoint.
 * `proxyFetch` prepends `/api/upstream`; the dashboard proxy injects
 * `account_id`. `type` is appended only when defined (the panel maps its
 * "all" sentinel to `undefined` before calling).
 */
export function buildRecentObservationsPath(
  cameraId: string,
  opts: { type?: string; limit: number },
): string {
  const params = new URLSearchParams();
  if (opts.type) params.set("type", opts.type);
  params.set("limit", String(opts.limit));
  return `/v1/cameras/${cameraId}/observations/recent?${params.toString()}`;
}

function asPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(p: Record<string, unknown>, key: string): string | undefined {
  const v = p[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function num(p: Record<string, unknown>, key: string): number | undefined {
  const v = p[key];
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function debugStr(p: Record<string, unknown>, key: string): string | undefined {
  return str(asPayload(p.debug), key);
}

/**
 * One-line human summary of an observation. Fully defensive: `payload` may be
 * missing, a non-object, or carry wrong-typed fields — this never throws and
 * falls back to a sensible string instead.
 */
export function summarizeObservation(obs: ObservationRecord): string {
  const p = asPayload(obs.payload);

  switch (obs.type) {
    case "processor.line_crossing": {
      const where = str(p, "line_label") ?? str(p, "line_id") ?? "line";
      const cum = num(p, "cumulative_count");
      const delta = num(p, "count_delta");
      return `${where} — total ${cum ?? "?"} (+${delta ?? "?"})`;
    }
    case "processor.roi_occupancy": {
      const where = str(p, "roi_label") ?? str(p, "roi_id") ?? "ROI";
      const total = num(p, "total_count");
      const reason = debugStr(p, "emit_reason");
      const base = `${where} — ${total ?? "?"} present`;
      return reason ? `${base} · ${reason}` : base;
    }
    case "processor.zone_entered":
    case "processor.zone_exited": {
      const verb = obs.type === "processor.zone_entered" ? "entered" : "exited";
      const where = str(p, "zone_label") ?? str(p, "zone_id") ?? "zone";
      const track = str(p, "track_id");
      return `track ${track ?? "?"} ${verb} ${where}`;
    }
    case "processor.dwell_started": {
      const where = str(p, "zone_label") ?? str(p, "zone_id") ?? "zone";
      const track = str(p, "track_id");
      return `track ${track ?? "?"} started dwell in ${where}`;
    }
    case "processor.dwell_updated": {
      const where = str(p, "zone_label") ?? str(p, "zone_id") ?? "zone";
      const track = str(p, "track_id");
      const dur = num(p, "duration_seconds");
      return `track ${track ?? "?"} dwelling ${dur ?? "?"}s in ${where}`;
    }
    case "processor.dwell_exceeded": {
      const where = str(p, "zone_label") ?? str(p, "zone_id") ?? "zone";
      const track = str(p, "track_id");
      const dur = num(p, "duration_seconds");
      const threshold = num(p, "threshold_seconds");
      return `track ${track ?? "?"} exceeded ${threshold ?? "?"}s (at ${dur ?? "?"}s) in ${where}`;
    }
    default:
      return obs.type || "observation";
  }
}
