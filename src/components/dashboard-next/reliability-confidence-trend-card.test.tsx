import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type {
  ConfidenceTrendPoint,
  ConfidenceTrendResponse,
  ConfidenceTrendSummary,
} from "@/lib/api/types";

import { ReliabilityConfidenceTrendCard } from "./reliability-confidence-trend-card";

function point(over: Partial<ConfidenceTrendPoint> = {}): ConfidenceTrendPoint {
  return {
    bucket_start: "2026-05-30T12:00:00Z",
    bucket_end: "2026-05-30T13:00:00Z",
    avg_confidence: 0.8,
    min_confidence: 0.5,
    max_confidence: 0.95,
    low_confidence_ratio: 0.1,
    confidence_stddev: 0.05,
    metric_count: 100,
    object_count_total: 200,
    confidence_sample_count: 100,
    ...over,
  };
}

function trend(
  points: ConfidenceTrendPoint[],
  summaryOver: Partial<ConfidenceTrendSummary> = {},
): ConfidenceTrendResponse {
  const rated = points.filter((p) => p.avg_confidence != null);
  const avgs = rated.map((p) => p.avg_confidence as number);
  return {
    camera_id: "11111111-1111-1111-1111-111111111111",
    range: "24h",
    bucket_size: "1h",
    points,
    summary: {
      point_count: points.length,
      latest_avg_confidence: avgs.length ? avgs[avgs.length - 1] : null,
      lowest_avg_confidence: avgs.length ? Math.min(...avgs) : null,
      highest_avg_confidence: avgs.length ? Math.max(...avgs) : null,
      total_confidence_samples: points.reduce(
        (a, p) => a + p.confidence_sample_count,
        0,
      ),
      latest_bucket_start: points.length
        ? points[points.length - 1].bucket_start
        : null,
      ...summaryOver,
    },
  };
}

function render(t: ConfidenceTrendResponse | null): string {
  return renderToStaticMarkup(<ReliabilityConfidenceTrendCard trend={t} />);
}

const polylineCount = (html: string) => (html.match(/<polyline/g) ?? []).length;

describe("ReliabilityConfidenceTrendCard", () => {
  test("always renders the card label", () => {
    const html = render(trend([point(), point({ avg_confidence: 0.6 })]));
    expect(html).toContain("detection confidence trend");
    expect(html).toContain("Hourly confidence history from recent processor output.");
  });

  test("null trend → unavailable state, no chart", () => {
    const html = render(null);
    expect(html).toContain("currently unavailable");
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("<polyline");
  });

  test("empty points → empty state, no chart", () => {
    const html = render(trend([]));
    expect(html).toContain("No confidence history yet");
    expect(html).not.toContain("<svg");
  });

  test("single confidence point → warming state, no line", () => {
    const html = render(trend([point({ avg_confidence: 0.8 })]));
    expect(html).toContain("Collecting confidence history");
    expect(html).not.toContain("<polyline");
  });

  test("two+ points → chart with line + stats", () => {
    const html = render(
      trend(
        [
          point({ avg_confidence: 0.82, confidence_sample_count: 12000 }),
          point({ avg_confidence: 0.7, confidence_sample_count: 345 }),
        ],
        {
          latest_avg_confidence: 0.82,
          lowest_avg_confidence: 0.7,
          total_confidence_samples: 12345,
        },
      ),
    );
    expect(html).toContain("<svg");
    expect(polylineCount(html)).toBeGreaterThanOrEqual(1);
    // Stats formatted as percentages + grouped sample count.
    expect(html).toContain("82%");
    expect(html).toContain("70%");
    expect(html).toContain("12,345");
    expect(html).toContain("Latest avg");
    expect(html).toContain("Lowest hourly");
    expect(html).toContain("Total samples");
  });

  test("interior null hour splits the line into separate segments", () => {
    const html = render(
      trend([
        point({ avg_confidence: 0.8 }),
        point({ avg_confidence: 0.9 }),
        point({ avg_confidence: null }), // empty-frame hour → gap
        point({ avg_confidence: 0.6 }),
        point({ avg_confidence: 0.7 }),
      ]),
    );
    expect(html).toContain("<svg");
    // Two runs of >=2 non-null points → two polylines (the gap is not bridged).
    expect(polylineCount(html)).toBeGreaterThanOrEqual(2);
  });

  test("isolated rated hours between gaps render dots, not lines", () => {
    // Three lone non-null points each surrounded by gaps → three length-1 runs,
    // so the line never reaches 2 points and each renders as a <circle> dot.
    const html = render(
      trend([
        point({ avg_confidence: 0.8 }),
        point({ avg_confidence: null }),
        point({ avg_confidence: 0.9 }),
        point({ avg_confidence: null }),
        point({ avg_confidence: 0.7 }),
      ]),
    );
    expect(html).toContain("<svg");
    expect(html).toContain("<circle");
    expect(polylineCount(html)).toBe(0);
  });

  test("null summary stats render as em dash, not NaN%", () => {
    const html = render(
      trend([point({ avg_confidence: 0.8 }), point({ avg_confidence: 0.6 })], {
        lowest_avg_confidence: null,
      }),
    );
    expect(html).toContain("—");
    expect(html).not.toContain("NaN");
  });

  test("does not leak internal weighted/tenant field names", () => {
    const html = render(trend([point(), point({ avg_confidence: 0.6 })]));
    for (const leaked of [
      "avg_confidence_weighted",
      "low_confidence_ratio_weighted",
      "confidence_stddev_weighted",
      "stream_session_id",
      "account_id",
    ]) {
      expect(html).not.toContain(leaked);
    }
  });
});
