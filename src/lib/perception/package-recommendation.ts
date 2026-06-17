// P5-I — use-case-driven package recommendation. Pure + unit-tested (no React,
// no I/O), so it's importable from the Processing panel and node-environment
// vitest.
//
// The recommendation is METADATA-DRIVEN: it scores each catalog package against
// the selected use case using the package's own `supported_triggers`,
// `supported_shapes`, `status`, `production_ready`, `test_mode_safe`,
// `warnings`, `best_for`, and `not_recommended_for` — never a hardcoded package
// id. An experimental package can never out-rank into "recommended" (it is
// always tiered "experimental"), so NvDCF stays a clearly-experimental
// alternative to the IOU YOLOX package unless the catalog itself changes.

import type { ProcessingPackage } from "@/lib/api/types";

export type UseCaseId =
  | "line_crossing"
  | "zone_presence"
  | "occupancy"
  | "dwell"
  | "general"
  | "debug";

export type RecommendationTier =
  | "recommended"
  | "compatible"
  | "experimental"
  | "not_recommended";

export interface UseCaseDef {
  id: UseCaseId;
  label: string;
  description: string;
  /** Analytics trigger names that satisfy this use case (matched vs `supported_triggers`). */
  triggers: string[];
  /** Geometry shapes this use case relies on (matched vs `supported_shapes`). */
  shapes: string[];
  /** Single-word tokens matched (per entry) against `best_for` / `not_recommended_for`. */
  keywords: string[];
  /** Package categories that satisfy this use case even with no trigger match. */
  categories?: string[];
  /** Whether an experimental package is an appropriate fit (debug/testing). */
  allowExperimental?: boolean;
}

// Trigger/shape vocabulary mirrors the api-server catalog
// (services/package_catalog.py: _ANALYTICS_TRIGGERS / _ANALYTICS_SHAPES).
const ALL_ANALYTICS_TRIGGERS = [
  "line_crossing",
  "roi_occupancy",
  "zone_entered",
  "zone_exited",
  "dwell_exceeded",
];

export const USE_CASES: UseCaseDef[] = [
  {
    id: "line_crossing",
    label: "People counting / line crossing",
    description: "Count people crossing a line in or out.",
    triggers: ["line_crossing"],
    shapes: ["line_segment"],
    keywords: ["line", "crossing", "count", "entry", "exit"],
  },
  {
    id: "zone_presence",
    label: "Zone entry & exit",
    description: "Detect when people enter or leave a defined zone.",
    triggers: ["zone_entered", "zone_exited"],
    shapes: ["polygon_roi"],
    keywords: ["zone", "entry", "exit", "presence", "person", "people"],
  },
  {
    id: "occupancy",
    label: "Occupancy monitoring",
    description: "Track how many people are inside an area over time.",
    triggers: ["roi_occupancy"],
    shapes: ["polygon_roi"],
    keywords: ["occupancy", "roi", "presence", "count"],
  },
  {
    id: "dwell",
    label: "Dwell / loitering detection",
    description: "Flag people who stay in an area longer than a threshold.",
    triggers: ["dwell_exceeded"],
    shapes: ["polygon_roi"],
    keywords: ["dwell", "loiter", "monitoring", "person"],
  },
  {
    id: "general",
    label: "General people analytics",
    description: "A full people-analytics chain (lines, zones, dwell, occupancy).",
    triggers: ALL_ANALYTICS_TRIGGERS,
    shapes: ["polygon_roi", "line_segment"],
    keywords: ["person", "people", "analytics"],
    categories: ["people_analytics"],
  },
  {
    id: "debug",
    label: "Debug / experimental testing",
    description: "Diagnostic and experimental probes for testing the pipeline.",
    triggers: [],
    shapes: [],
    keywords: ["debug", "probe", "experimental", "test", "diagnostic"],
    categories: ["diagnostic", "mock"],
    allowExperimental: true,
  },
];

export function getUseCase(id: UseCaseId): UseCaseDef | undefined {
  return USE_CASES.find((u) => u.id === id);
}

const tokenize = (entry: string): string[] => entry.toLowerCase().split(/[_\s-]+/);

/** True if any token of `entry` is one of the use case's keywords. */
function entryMatchesUseCase(entry: string, uc: UseCaseDef): boolean {
  const kw = new Set(uc.keywords);
  return tokenize(entry).some((tok) => kw.has(tok));
}

/**
 * Whether a package can perform the use case at all (regardless of how good a
 * fit). A deprecated package is never capable. A specific use case needs ≥1
 * matching trigger; `general`/`debug` also accept their declared categories,
 * and `debug` accepts experimental packages.
 */
export function isCapable(pkg: ProcessingPackage, uc: UseCaseDef): boolean {
  if (pkg.status === "deprecated") return false;
  if (uc.triggers.some((t) => pkg.supported_triggers.includes(t))) return true;
  if (uc.categories?.includes(pkg.category)) return true;
  if (uc.allowExperimental && pkg.status === "experimental") return true;
  return false;
}

/**
 * A simple additive fitness score. Higher is better. Only meaningful relative
 * to other packages for the SAME use case. See the module header for the
 * metadata inputs.
 */
export function scorePackageForUseCase(
  pkg: ProcessingPackage,
  uc: UseCaseDef,
): number {
  let score = 0;

  const triggerMatches = uc.triggers.filter((t) =>
    pkg.supported_triggers.includes(t),
  ).length;
  const shapeMatches = uc.shapes.filter((s) =>
    pkg.supported_shapes.includes(s),
  ).length;
  score += triggerMatches * 3;
  score += shapeMatches;

  if (pkg.status === "supported") score += 3;
  else if (pkg.status === "probe") score += 2;
  else if (pkg.status === "experimental") score -= 4;
  else if (pkg.status === "deprecated") score -= 100;

  if (pkg.test_mode_safe) score += 1;
  if (!pkg.production_ready) score -= 0.5;
  score -= pkg.warnings.length;

  if (uc.categories?.includes(pkg.category)) score += 2;

  // best_for / not_recommended_for keyword matching (per entry, token-exact so
  // "person_entry_exit" matches but generic substrings don't over-fire).
  score += pkg.best_for.filter((b) => entryMatchesUseCase(b, uc)).length;
  score -= pkg.not_recommended_for.filter((n) => entryMatchesUseCase(n, uc)).length * 2;

  return score;
}

export interface PackageRecommendation {
  pkg: ProcessingPackage;
  score: number;
  tier: RecommendationTier;
}

const TIER_ORDER: Record<RecommendationTier, number> = {
  recommended: 0,
  compatible: 1,
  experimental: 2,
  not_recommended: 3,
};

export const TIER_LABEL: Record<RecommendationTier, string> = {
  recommended: "Recommended",
  compatible: "Compatible",
  experimental: "Experimental",
  not_recommended: "Not recommended",
};

/**
 * Score + tier every package for the use case, sorted best-first. Exactly one
 * capable, non-experimental, non-deprecated package (the top scorer) is tiered
 * `recommended`; the rest of the capable non-experimental ones are `compatible`;
 * capable experimental ones are `experimental`; everything incapable or
 * deprecated is `not_recommended`.
 */
export function recommendPackages(
  packages: ProcessingPackage[],
  uc: UseCaseDef,
): PackageRecommendation[] {
  const scored = packages.map((pkg) => ({
    pkg,
    score: scorePackageForUseCase(pkg, uc),
    capable: isCapable(pkg, uc),
  }));

  const eligible = scored.filter(
    (s) => s.capable && s.pkg.status !== "experimental",
  );
  const topScore = eligible.length
    ? Math.max(...eligible.map((s) => s.score))
    : Number.NEGATIVE_INFINITY;

  let recommendedAssigned = false;
  const recs: PackageRecommendation[] = scored.map((s) => {
    let tier: RecommendationTier;
    if (!s.capable || s.pkg.status === "deprecated") {
      tier = "not_recommended";
    } else if (s.pkg.status === "experimental") {
      tier = "experimental";
    } else if (s.score === topScore && !recommendedAssigned) {
      tier = "recommended";
      recommendedAssigned = true;
    } else {
      tier = "compatible";
    }
    return { pkg: s.pkg, score: s.score, tier };
  });

  recs.sort(
    (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || b.score - a.score,
  );
  return recs;
}
