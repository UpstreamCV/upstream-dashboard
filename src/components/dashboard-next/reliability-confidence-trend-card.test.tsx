// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import type {
  ConfidenceTrendPoint,
  ConfidenceTrendResponse,
} from "@/lib/api/types";

import { ReliabilityConfidenceTrendCard } from "./reliability-confidence-trend-card";

afterEach(cleanup);

let hour = 0;
function point(over: Partial<ConfidenceTrendPoint> = {}): ConfidenceTrendPoint {
  const start = `2026-05-30T${String(hour++ % 24).padStart(2, "0")}:00:00Z`;
  return {
    bucket_start: start,
    bucket_end: start,
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
  summaryOver: Partial<ConfidenceTrendResponse["summary"]> = {},
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

// A range with enough history to draw a chart AND yield a real (non-warming)
// verdict: 4 flat hourly points (→ Stable), 400 confidence samples total.
const chart = (over?: Partial<ConfidenceTrendResponse["summary"]>) =>
  trend(
    [
      point({ avg_confidence: 0.7 }),
      point({ avg_confidence: 0.7 }),
      point({ avg_confidence: 0.7 }),
      point({ avg_confidence: 0.7 }),
    ],
    over,
  );

function get7dButton() {
  return screen.getByRole("button", { name: "7d" });
}
function get24hButton() {
  return screen.getByRole("button", { name: "24h" });
}

describe("ReliabilityConfidenceTrendCard (M8-A toggle + badge)", () => {
  test("always renders the label + a 24h|7d toggle, defaulting to 24h", () => {
    render(<ReliabilityConfidenceTrendCard trend24h={chart()} trend7d={chart()} />);
    expect(screen.getByText("detection confidence trend")).toBeTruthy();
    expect(get24hButton().getAttribute("aria-pressed")).toBe("true");
    expect(get7dButton().getAttribute("aria-pressed")).toBe("false");
  });

  test("clicking 7d shows the 7d dataset, clicking 24h returns", () => {
    render(
      <ReliabilityConfidenceTrendCard
        trend24h={chart({ total_confidence_samples: 12345 })}
        trend7d={chart({ total_confidence_samples: 67890 })}
      />,
    );
    expect(screen.getByText("12,345")).toBeTruthy(); // 24h total samples
    expect(screen.queryByText("67,890")).toBeNull();

    fireEvent.click(get7dButton());
    expect(get7dButton().getAttribute("aria-pressed")).toBe("true");
    expect(get24hButton().getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("67,890")).toBeTruthy(); // 7d total samples
    expect(screen.queryByText("12,345")).toBeNull();

    fireEvent.click(get24hButton());
    expect(get24hButton().getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("12,345")).toBeTruthy();
  });

  test("renders a sparkline for a range with a real verdict (>=4 valid points)", () => {
    const { container } = render(
      <ReliabilityConfidenceTrendCard trend24h={chart()} trend7d={chart()} />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.querySelector("polyline")).toBeTruthy();
  });

  test("chart and 'Warming up' never co-render: 2-3 rated points show no line", () => {
    // 3 rated points = not enough to judge a trend → "Warming up" badge AND no
    // chart (the body shows the collecting copy instead). The two agree.
    const sparse = trend([
      point({ avg_confidence: 0.8 }),
      point({ avg_confidence: 0.7 }),
      point({ avg_confidence: 0.75 }),
    ]);
    const { container } = render(
      <ReliabilityConfidenceTrendCard trend24h={sparse} trend7d={chart()} />,
    );
    expect(screen.getByText("Trend: Warming up")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryByText(/^Trend: (Stable|Improving|Degrading)$/)).toBeNull();
  });

  test("a real verdict shows the chart and NOT the warming badge", () => {
    const { container } = render(
      <ReliabilityConfidenceTrendCard trend24h={chart()} trend7d={chart()} />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByText("Trend: Stable")).toBeTruthy();
    expect(screen.queryByText("Trend: Warming up")).toBeNull();
  });

  test("isolated rated hour between gaps renders a dot (circle), not a line", () => {
    // 4 valid points (→ real verdict so the chart draws); the lone 0.8 between
    // two null hours becomes a <circle>, the 0.7/0.65/0.6 run a <polyline>.
    const gapped = trend([
      point({ avg_confidence: 0.8 }),
      point({ avg_confidence: null }),
      point({ avg_confidence: 0.7 }),
      point({ avg_confidence: 0.65 }),
      point({ avg_confidence: 0.6 }),
    ]);
    const { container } = render(
      <ReliabilityConfidenceTrendCard trend24h={gapped} trend7d={chart()} />,
    );
    expect(container.querySelector("circle")).toBeTruthy();
    expect(container.querySelectorAll("polyline").length).toBe(1);
  });

  test("null range → unavailable copy, no chart, no badge", () => {
    const { container } = render(
      <ReliabilityConfidenceTrendCard trend24h={null} trend7d={chart()} />,
    );
    expect(screen.getByText(/currently unavailable/)).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.queryByText(/^Trend:/)).toBeNull();
    // The OTHER range still has data — toggling reveals it.
    fireEvent.click(get7dButton());
    expect(container.querySelector("svg")).toBeTruthy();
  });

  test("empty points → empty copy, no chart", () => {
    const { container } = render(
      <ReliabilityConfidenceTrendCard trend24h={trend([])} trend7d={chart()} />,
    );
    expect(screen.getByText(/No confidence history yet/)).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();
  });

  test("single rated point → warming copy, no line", () => {
    const { container } = render(
      <ReliabilityConfidenceTrendCard
        trend24h={trend([point({ avg_confidence: 0.8 })])}
        trend7d={chart()}
      />,
    );
    expect(screen.getByText(/Collecting confidence history/)).toBeTruthy();
    expect(container.querySelector("polyline")).toBeNull();
  });

  test("badge reads Degrading when the late half drops ≥15%", () => {
    const degrading = trend([
      point({ avg_confidence: 0.8, confidence_sample_count: 100 }),
      point({ avg_confidence: 0.8, confidence_sample_count: 100 }),
      point({ avg_confidence: 0.6, confidence_sample_count: 100 }),
      point({ avg_confidence: 0.6, confidence_sample_count: 100 }),
    ]);
    render(<ReliabilityConfidenceTrendCard trend24h={degrading} trend7d={chart()} />);
    expect(screen.getByText("Trend: Degrading")).toBeTruthy();
  });

  test("badge reads Improving when the late half rises ≥15%", () => {
    const improving = trend([
      point({ avg_confidence: 0.6, confidence_sample_count: 100 }),
      point({ avg_confidence: 0.6, confidence_sample_count: 100 }),
      point({ avg_confidence: 0.75, confidence_sample_count: 100 }),
      point({ avg_confidence: 0.75, confidence_sample_count: 100 }),
    ]);
    render(<ReliabilityConfidenceTrendCard trend24h={improving} trend7d={chart()} />);
    expect(screen.getByText("Trend: Improving")).toBeTruthy();
  });

  test("badge reads Warming up when there is not enough history", () => {
    render(<ReliabilityConfidenceTrendCard trend24h={trend([])} trend7d={chart()} />);
    expect(screen.getByText("Trend: Warming up")).toBeTruthy();
  });

  test("does not crash on null avg_confidence (gap splits the line)", () => {
    const gapped = trend([
      point({ avg_confidence: 0.8 }),
      point({ avg_confidence: 0.9 }),
      point({ avg_confidence: null }),
      point({ avg_confidence: 0.6 }),
      point({ avg_confidence: 0.7 }),
    ]);
    const { container } = render(
      <ReliabilityConfidenceTrendCard trend24h={gapped} trend7d={chart()} />,
    );
    expect(container.querySelectorAll("polyline").length).toBeGreaterThanOrEqual(2);
  });

  test("does not leak internal weighted/tenant field names", () => {
    const { container } = render(
      <ReliabilityConfidenceTrendCard trend24h={chart()} trend7d={chart()} />,
    );
    const html = container.innerHTML;
    for (const leaked of [
      "avg_confidence_weighted",
      "stream_session_id",
      "account_id",
    ]) {
      expect(html).not.toContain(leaked);
    }
  });
});
