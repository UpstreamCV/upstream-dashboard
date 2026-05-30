import { describe, expect, test } from "vitest";
import type { ConfidenceTrendPoint } from "@/lib/api/types";
import { interpretConfidenceTrend } from "./confidence-trend-interpretation";

let hour = 0;
function pt(avg: number | null, samples: number): ConfidenceTrendPoint {
  const start = `2026-05-30T${String(hour++ % 24).padStart(2, "0")}:00:00Z`;
  return {
    bucket_start: start,
    bucket_end: start,
    avg_confidence: avg,
    min_confidence: avg,
    max_confidence: avg,
    low_confidence_ratio: 0.1,
    confidence_stddev: 0.05,
    metric_count: samples,
    object_count_total: samples,
    confidence_sample_count: samples,
  };
}

describe("interpretConfidenceTrend", () => {
  test("fewer than 4 valid points → warming (not enough history)", () => {
    const v = interpretConfidenceTrend([pt(0.8, 100), pt(0.8, 100), pt(0.8, 100)]);
    expect(v.status).toBe("warming");
    expect(v.label).toBe("Warming up");
  });

  test("enough points but < 20 total samples → warming", () => {
    const v = interpretConfidenceTrend([pt(0.8, 4), pt(0.8, 4), pt(0.8, 4), pt(0.8, 4)]); // 16 < 20
    expect(v.status).toBe("warming");
  });

  test("flat confidence → stable", () => {
    const v = interpretConfidenceTrend([
      pt(0.7, 100),
      pt(0.7, 100),
      pt(0.7, 100),
      pt(0.7, 100),
    ]);
    expect(v.status).toBe("stable");
  });

  test("late half higher by ≥15% → improving", () => {
    // early avg 0.6, late avg 0.72 → +0.20
    const v = interpretConfidenceTrend([
      pt(0.6, 100),
      pt(0.6, 100),
      pt(0.72, 100),
      pt(0.72, 100),
    ]);
    expect(v.status).toBe("improving");
  });

  test("late half lower by ≥15% → degrading", () => {
    // early 0.8, late 0.6 → -0.25
    const v = interpretConfidenceTrend([
      pt(0.8, 100),
      pt(0.8, 100),
      pt(0.6, 100),
      pt(0.6, 100),
    ]);
    expect(v.status).toBe("degrading");
  });

  test("exactly -0.15 → degrading (inclusive boundary)", () => {
    // early 1.0, late 0.85 → (0.85-1.0)/1.0 = -0.15
    const v = interpretConfidenceTrend([
      pt(1.0, 100),
      pt(1.0, 100),
      pt(0.85, 100),
      pt(0.85, 100),
    ]);
    expect(v.status).toBe("degrading");
  });

  test("exactly +0.15 → improving (inclusive boundary)", () => {
    // early 0.8, late 0.92 → (0.92-0.8)/0.8 = 0.15
    const v = interpretConfidenceTrend([
      pt(0.8, 100),
      pt(0.8, 100),
      pt(0.92, 100),
      pt(0.92, 100),
    ]);
    expect(v.status).toBe("improving");
  });

  test("just inside the threshold (±0.149) → stable", () => {
    // early 1.0, late 0.851 → -0.149
    const v = interpretConfidenceTrend([
      pt(1.0, 100),
      pt(1.0, 100),
      pt(0.851, 100),
      pt(0.851, 100),
    ]);
    expect(v.status).toBe("stable");
  });

  test("weighting matters: a high-sample low point dominates its half", () => {
    // early 0.8. late = {0.95, 5 samples} + {0.6, 1000 samples}.
    // weighted late ≈ 0.602 → ratio ≈ -0.25 → DEGRADING.
    // (an UNWEIGHTED mean would be 0.775 → ~stable — proving the weighting.)
    const v = interpretConfidenceTrend([
      pt(0.8, 500),
      pt(0.8, 500),
      pt(0.95, 5),
      pt(0.6, 1000),
    ]);
    expect(v.status).toBe("degrading");
  });

  test("early weighted average of zero → warming (no divide-by-zero blow-up)", () => {
    const v = interpretConfidenceTrend([
      pt(0.0, 100),
      pt(0.0, 100),
      pt(0.5, 100),
      pt(0.5, 100),
    ]);
    expect(v.status).toBe("warming");
  });

  test("null hours don't count toward the valid-point minimum", () => {
    // Only 3 rated points among the 6 → below MIN_VALID_POINTS → warming.
    const v = interpretConfidenceTrend([
      pt(0.8, 100),
      pt(null, 0),
      pt(0.8, 100),
      pt(null, 0),
      pt(0.8, 100),
      pt(null, 0),
    ]);
    expect(v.status).toBe("warming");
  });

  test("interleaved null hours are excluded from the first/second-half split", () => {
    // 4 rated among 6 → reaches the split; nulls at indices 1,3 are ignored, so
    // valid = [0.8, 0.8, 0.6, 0.6] → early 0.8 / late 0.6 → -0.25 → degrading.
    const v = interpretConfidenceTrend([
      pt(0.8, 100),
      pt(null, 0),
      pt(0.8, 100),
      pt(null, 0),
      pt(0.6, 100),
      pt(0.6, 100),
    ]);
    expect(v.status).toBe("degrading");
  });

  test("odd valid count: the middle hour is excluded from both halves", () => {
    // 5 valid, half=2. early=[0.8,0.8], late=[0.8,0.8], middle 0.0 dropped →
    // stable. If the extreme middle were pulled into a half it would flip the
    // verdict (late would drop to ~0.53 → degrading), so this pins the exclusion.
    const v = interpretConfidenceTrend([
      pt(0.8, 100),
      pt(0.8, 100),
      pt(0.0, 100),
      pt(0.8, 100),
      pt(0.8, 100),
    ]);
    expect(v.status).toBe("stable");
  });

  test("late half with zero confidence weight → warming (lateAvg null guard)", () => {
    // 4 valid points / 200 samples pass the gates, but the late half's points
    // carry 0 confidence samples → its weighted average is null → warming.
    const v = interpretConfidenceTrend([
      pt(0.8, 100),
      pt(0.8, 100),
      pt(0.5, 0),
      pt(0.5, 0),
    ]);
    expect(v.status).toBe("warming");
  });

  test("empty points → warming", () => {
    expect(interpretConfidenceTrend([]).status).toBe("warming");
  });
});
