import type { CameraStatus } from "@/lib/api/types";
import type { DotStatus } from "./status-dot";

// The Figma "Cameras" redesign groups the fleet into four buckets that do NOT
// map 1:1 to the DB CameraStatus column (idle|streaming|error|disabled). We
// derive them from the camera's status plus whether it has an OPEN alert:
//
//   live    — streaming and no open alert        (green)   "Live"
//   review  — has an open alert (any non-error)  (orange)  "Needs Review"
//   offline — status === 'error'                 (red)     "Offline / Urgent"
//   idle    — idle/disabled and no open alert     (grey)    "Idle"
//
// `error` always wins (offline/urgent) even if it also has an alert.
export type CameraBucket = "live" | "review" | "offline" | "idle";

export function deriveCameraBucket(
  status: CameraStatus,
  hasOpenAlert: boolean,
): CameraBucket {
  if (status === "error") return "offline";
  if (hasOpenAlert) return "review";
  if (status === "streaming") return "live";
  return "idle"; // idle | disabled
}

export interface BucketMeta {
  /** Status-tile heading, e.g. "LIVE & WITHOUT ISSUE". */
  tileLabel: string;
  /** Filter chip / card badge label, e.g. "Live". */
  label: string;
  /** Longer badge used on the card overlay, e.g. "Offline / Urgent". */
  badgeLabel: string;
  /** StatusDot color key. */
  dot: DotStatus;
  /** CSS custom property holding the accent color (see theme.css). */
  accentVar: string;
  /** Solid badge background CSS (full-opacity accent, except idle's grey). */
  badgeBg: string;
}

export const BUCKET_META: Record<CameraBucket, BucketMeta> = {
  live: {
    tileLabel: "Live & without issue",
    label: "Live",
    badgeLabel: "Live",
    dot: "green",
    accentVar: "var(--dn-green-text)",
    badgeBg: "var(--dn-live)",
  },
  review: {
    tileLabel: "Need review",
    label: "Needs review",
    badgeLabel: "Needs Review",
    dot: "orange",
    accentVar: "var(--dn-orange)",
    badgeBg: "var(--dn-orange)",
  },
  offline: {
    tileLabel: "Offline / urgent",
    label: "Offline",
    badgeLabel: "Offline / Urgent",
    dot: "red",
    accentVar: "var(--dn-red)",
    badgeBg: "var(--dn-red)",
  },
  idle: {
    tileLabel: "Idle / unused",
    label: "Idle",
    badgeLabel: "Idle",
    dot: "neutral",
    accentVar: "var(--dn-grey-dot)",
    badgeBg: "var(--dn-grey)",
  },
};

// Order used for the filter-chip row and the four summary stat tiles.
export const BUCKET_ORDER: CameraBucket[] = [
  "live",
  "review",
  "offline",
  "idle",
];

// Map an alert/finding severity string to the redesign's accent + dot. Used by
// the Home triage rows and recent-events feed (alerts carry a freeform
// `severity` string; the api-server emits critical|warning|info today).
export function severityMeta(severity: string): {
  dot: DotStatus;
  accentVar: string;
  chipLabel: string;
  chipBg: string;
  chipText: string;
} {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "error") {
    return {
      dot: "red",
      accentVar: "var(--dn-red)",
      chipLabel: "Critical",
      chipBg: "var(--dn-red-soft)",
      chipText: "var(--dn-red)",
    };
  }
  if (s === "warning" || s === "warn") {
    return {
      dot: "orange",
      accentVar: "var(--dn-orange)",
      chipLabel: "Warning",
      chipBg: "var(--dn-orange-soft)",
      chipText: "var(--dn-orange)",
    };
  }
  return {
    dot: "yellow",
    accentVar: "var(--dn-yellow)",
    chipLabel: "Info",
    chipBg: "var(--dn-yellow-soft)",
    chipText: "var(--dn-yellow)",
  };
}
