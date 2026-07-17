// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { FleetOverview } from "./fleet-overview";
import type { FleetTrendPoint, FleetTrendResponse } from "@/lib/api/types";

afterEach(cleanup);

function point(
  hour: number,
  { critical = 0, review = 0, healthy = 0 } = {},
): FleetTrendPoint {
  const start = `2026-07-16T${String(hour).padStart(2, "0")}:00:00Z`;
  const end = `2026-07-16T${String(hour + 1).padStart(2, "0")}:00:00Z`;
  return {
    bucket_start: start,
    bucket_end: end,
    critical,
    review,
    healthy,
    reporting_cameras: critical + review + healthy,
  };
}

function trend(points: FleetTrendPoint[], totalCameras = 3): FleetTrendResponse {
  const latest = points.at(-1) ?? null;
  return {
    range: "24h",
    bucket_size: "1h",
    points,
    summary: {
      point_count: points.length,
      latest_bucket_start: latest?.bucket_start ?? null,
      latest_critical: latest?.critical ?? 0,
      latest_review: latest?.review ?? 0,
      latest_healthy: latest?.healthy ?? 0,
      total_cameras: totalCameras,
    },
  };
}

/**
 * LegendItem renders `{count} <span>{label}</span>`, so the label's parent
 * carries "4 Critical". Assert the WHOLE string: `toContain("4")` would also
 * pass on "14 Critical", and the point of these tests is that the number is
 * exactly the latest bucket's.
 */
function legendText(label: string): string {
  return screen.getByText(label).parentElement?.textContent?.trim() ?? "";
}

describe("FleetOverview", () => {
  test("legend reads the LATEST bucket, not the first", () => {
    render(
      <FleetOverview
        trend={trend([
          point(1, { healthy: 9 }),
          point(2, { healthy: 2, review: 1, critical: 4 }),
        ])}
      />,
    );

    expect(legendText("Critical")).toBe("4 Critical");
    expect(legendText("Review")).toBe("1 Review");
    // 2, not the first bucket's 9.
    expect(legendText("Healthy")).toBe("2 Healthy");
  });

  test("states the reporting denominator so a small count can't imply a small fleet", () => {
    render(<FleetOverview trend={trend([point(1, { healthy: 1 })], 40)} />);
    expect(screen.getByText(/1 of 40 reporting/)).toBeTruthy();
  });

  test("says fleet health is unavailable rather than drawing a shape", () => {
    render(<FleetOverview trend={null} />);
    expect(screen.getByText(/unavailable right now/i)).toBeTruthy();
    // No fabricated series: the old tile drew a sine wave here.
    expect(document.querySelector("polyline")).toBeNull();
  });

  test("legend shows — not 0 when the trend is unavailable", () => {
    // "0 Critical" is the most reassuring lie this tile could tell: it reads as
    // "nothing is wrong" when the truth is "we don't know". The chart says
    // unavailable; the legend above it must not contradict that with hard zeros.
    // Reachable in prod — the dashboard deploys on merge while the api-server
    // needs a manual EC2 deploy, so the endpoint can 404 for real.
    render(<FleetOverview trend={null} />);

    expect(legendText("Critical")).toBe("— Critical");
    expect(legendText("Review")).toBe("— Review");
    expect(legendText("Healthy")).toBe("— Healthy");
  });

  test("legend shows real 0s when the fleet is genuinely quiet", () => {
    // The counterpart to the above: a reporting fleet with nothing wrong must
    // still say 0, not —. Absent data and zero data are different claims.
    render(<FleetOverview trend={trend([point(1), point(2)], 5)} />);

    expect(legendText("Critical")).toBe("0 Critical");
    expect(legendText("Healthy")).toBe("0 Healthy");
  });

  test("distinguishes 'no heartbeats' from 'unavailable'", () => {
    render(<FleetOverview trend={trend([], 2)} />);
    expect(screen.getByText(/No heartbeats in the last 24 hours/i)).toBeTruthy();
    expect(document.querySelector("polyline")).toBeNull();
  });

  test("plots one polyline per series when there is history", () => {
    render(
      <FleetOverview
        trend={trend([point(1, { healthy: 3 }), point(2, { healthy: 3 })])}
      />,
    );
    expect(document.querySelectorAll("polyline")).toHaveLength(3);
  });

  test("an all-zero fleet still charts (quiet is not the same as missing)", () => {
    render(<FleetOverview trend={trend([point(1), point(2)], 5)} />);
    expect(document.querySelectorAll("polyline")).toHaveLength(3);
    expect(screen.queryByText(/unavailable/i)).toBeNull();
  });
});
