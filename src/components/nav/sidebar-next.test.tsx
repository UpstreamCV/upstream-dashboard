import { describe, it, expect } from "vitest";
import { NAV } from "./sidebar-next";

// The rail lights exactly ONE section per route via each section's `match` regex.
// This guards two things at once: (1) every representative deep route maps to the
// right section, and (2) the widened section regexes never OVERLAP (a path must
// match exactly one section — `toEqual([label])` fails on 0 or 2+ matches).
const CASES: [string, string][] = [
  ["/", "Home"],
  ["/issues", "Issues"],
  ["/issues?status=open", "Issues"],
  ["/cameras", "Cameras"],
  ["/cameras/cam_123", "Cameras"],
  ["/cameras/cam_123/overview", "Cameras"],
  ["/cameras/cam_123/monitor", "Cameras"],
  ["/cameras/new", "Cameras"],
  ["/agents", "Cameras"],
  ["/agents/agt_9", "Cameras"],
  ["/stream-sessions", "Cameras"],
  ["/stream-sessions/sess_1", "Cameras"],
  ["/rules", "Event Outputs"],
  ["/workflows", "Event Outputs"],
  ["/workflows/new", "Event Outputs"],
  ["/alerts", "Event Outputs"],
  ["/alerts/alr_5", "Event Outputs"],
  ["/api-tokens", "Dev Settings"],
  ["/event-schema", "Dev Settings"],
  ["/api-docs", "Dev Settings"],
  ["/plan-usage", "Account"],
  ["/billing", "Account"],
  ["/settings", "Account"],
  ["/audit-logs", "Account"],
];

describe("sidebar NAV section matching", () => {
  it.each(CASES)("%s lights exactly the %s pill", (path, label) => {
    const matched = NAV.filter((s) => s.match.test(path));
    expect(matched.map((s) => s.label)).toEqual([label]);
  });

  it("anchors every section match at the path root", () => {
    for (const s of NAV) {
      expect(s.match.source.startsWith("^")).toBe(true);
    }
  });

  it("has exactly six top-level sections", () => {
    expect(NAV).toHaveLength(6);
  });
});
