import { describe, expect, test } from "vitest";
import type {
  GeometryConfig,
  GeometryLine,
  GeometryRoi,
} from "@/lib/api/types";
import {
  GEOMETRY_LIMITS,
  LINE_DIRECTIONS,
  createGeometryValidationSummary,
  validateGeometryConfig,
  validateGeometryLabel,
  validateGeometryLine,
  validateGeometryRoi,
  validateGeometrySlug,
  validateNormalizedPoint,
} from "@/lib/perception/geometry-schema";

// Helpers — small factories so each test states only what it overrides.

function roi(over: Partial<GeometryRoi> = {}): GeometryRoi {
  return {
    id: "entry-roi",
    label: "Entry ROI",
    type: "polygon",
    points: [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.5, y: 0.9 },
    ],
    enabled: true,
    ...over,
  };
}

function line(over: Partial<GeometryLine> = {}): GeometryLine {
  return {
    id: "entry-line",
    label: "Entry Line",
    points: [
      { x: 0.0, y: 0.5 },
      { x: 1.0, y: 0.5 },
    ],
    direction: "any",
    enabled: true,
    ...over,
  };
}

function config(over: Partial<GeometryConfig> = {}): GeometryConfig {
  return {
    version: 1,
    frame: { coordinate_space: "normalized", width: 1280, height: 720 },
    rois: [roi()],
    lines: [line()],
    ...over,
  };
}

describe("validateNormalizedPoint", () => {
  test("accepts a valid point at the bounds", () => {
    expect(validateNormalizedPoint({ x: 0, y: 1 }, "p")).toEqual([]);
    expect(validateNormalizedPoint({ x: 0.5, y: 0.5 }, "p")).toEqual([]);
  });

  test("rejects x below 0 and y above 1", () => {
    const issues = validateNormalizedPoint({ x: -0.1, y: 1.5 }, "p");
    const codes = issues.map((i) => i.code);
    expect(codes).toContain("point_x_out_of_range");
    expect(codes).toContain("point_y_out_of_range");
  });

  test("rejects non-numeric x/y", () => {
    const issues = validateNormalizedPoint({ x: "0.5", y: null }, "p");
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["point_x_not_number", "point_y_not_number"]),
    );
  });

  test("rejects non-object inputs", () => {
    expect(validateNormalizedPoint(null, "p")[0].code).toBe("point_not_object");
    expect(validateNormalizedPoint([0, 1], "p")[0].code).toBe("point_not_object");
  });
});

describe("validateGeometrySlug", () => {
  test("accepts lowercase + digits + dashes", () => {
    expect(validateGeometrySlug("entry-roi-1", "id")).toEqual([]);
    expect(validateGeometrySlug("a", "id")).toEqual([]);
  });

  test("rejects uppercase, leading dash, special chars, empty", () => {
    expect(validateGeometrySlug("Entry-ROI", "id")[0].code).toBe("id_pattern");
    expect(validateGeometrySlug("-foo", "id")[0].code).toBe("id_pattern");
    expect(validateGeometrySlug("foo_bar", "id")[0].code).toBe("id_pattern");
    expect(validateGeometrySlug("", "id")[0].code).toBe("id_missing");
  });

  test("rejects ids longer than 64 chars", () => {
    expect(validateGeometrySlug("a".repeat(65), "id")[0].code).toBe("id_pattern");
    expect(validateGeometrySlug("a".repeat(64), "id")).toEqual([]);
  });
});

describe("validateGeometryLabel", () => {
  test("accepts null/undefined and short strings", () => {
    expect(validateGeometryLabel(null, "label")).toEqual([]);
    expect(validateGeometryLabel(undefined, "label")).toEqual([]);
    expect(validateGeometryLabel("Entry", "label")).toEqual([]);
    expect(validateGeometryLabel("", "label")).toEqual([]);
  });

  test("rejects 81-char label and non-strings", () => {
    expect(validateGeometryLabel("x".repeat(81), "label")[0].code).toBe(
      "label_too_long",
    );
    expect(validateGeometryLabel(42, "label")[0].code).toBe("label_not_string");
  });
});

describe("validateGeometryRoi", () => {
  test("valid polygon ROI passes", () => {
    expect(validateGeometryRoi(roi(), "rois[0]")).toEqual([]);
  });

  test("ROI with fewer than 3 points fails", () => {
    const issues = validateGeometryRoi(
      roi({
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      }),
      "rois[0]",
    );
    expect(issues.map((i) => i.code)).toContain("roi_points_too_few");
  });

  test("ROI with more than 64 points fails", () => {
    const tooMany = Array.from({ length: 65 }, (_, i) => ({
      x: (i % 10) / 10,
      y: ((i + 1) % 10) / 10,
    }));
    expect(
      validateGeometryRoi(roi({ points: tooMany }), "rois[0]").map(
        (i) => i.code,
      ),
    ).toContain("roi_points_too_many");
  });

  test('non-"polygon" type fails', () => {
    const issues = validateGeometryRoi(
      { ...roi(), type: "ellipse" },
      "rois[0]",
    );
    expect(issues.map((i) => i.code)).toContain("roi_type_invalid");
  });

  test("propagates point validation errors with full paths", () => {
    const issues = validateGeometryRoi(
      roi({
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.1 },
          { x: 1.5, y: 0.5 },
        ],
      }),
      "rois[0]",
    );
    const outOfRange = issues.find((i) => i.code === "point_x_out_of_range");
    expect(outOfRange?.path).toBe("rois[0].points[2].x");
  });

  test("missing enabled boolean fails", () => {
    const noEnabled = { ...roi() } as Partial<GeometryRoi>;
    delete noEnabled.enabled;
    expect(
      validateGeometryRoi(noEnabled, "rois[0]").map((i) => i.code),
    ).toContain("roi_enabled_missing");
  });
});

describe("validateGeometryLine", () => {
  test("valid line passes", () => {
    expect(validateGeometryLine(line(), "lines[0]")).toEqual([]);
  });

  test("line with 1 point fails", () => {
    expect(
      validateGeometryLine(
        line({ points: [{ x: 0, y: 0 }] }),
        "lines[0]",
      ).map((i) => i.code),
    ).toContain("line_points_wrong_count");
  });

  test("line with 3 points fails", () => {
    const three: GeometryLine["points"] = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
    ];
    expect(
      validateGeometryLine(line({ points: three }), "lines[0]").map(
        (i) => i.code,
      ),
    ).toContain("line_points_wrong_count");
  });

  test("out-of-range point fails", () => {
    expect(
      validateGeometryLine(
        line({
          points: [
            { x: 0, y: 0 },
            { x: 1.1, y: 0.5 },
          ],
        }),
        "lines[0]",
      ).map((i) => i.code),
    ).toContain("point_x_out_of_range");
  });

  test("each LINE_DIRECTIONS value is accepted", () => {
    for (const dir of LINE_DIRECTIONS) {
      expect(validateGeometryLine(line({ direction: dir }), "lines[0]")).toEqual(
        [],
      );
    }
  });

  test('direction outside enum fails (e.g. "a_to_b" from user proposal)', () => {
    // Guards against the original proposal sneaking back in.
    expect(
      validateGeometryLine(
        // @ts-expect-error — deliberately bad direction
        line({ direction: "a_to_b" }),
        "lines[0]",
      ).map((i) => i.code),
    ).toContain("line_direction_invalid");
  });
});

describe("validateGeometryConfig", () => {
  test("valid full config passes", () => {
    expect(validateGeometryConfig(config())).toEqual([]);
  });

  test("version != 1 fails", () => {
    const c = { ...config(), version: 2 as unknown as 1 };
    expect(validateGeometryConfig(c).map((i) => i.code)).toContain(
      "config_version_invalid",
    );
  });

  test('coordinate_space != "normalized" fails', () => {
    const c = config();
    // @ts-expect-error — deliberately bad coordinate space (user-proposed name)
    c.frame.coordinate_space = "normalized_frame";
    expect(validateGeometryConfig(c).map((i) => i.code)).toContain(
      "frame_coordinate_space_invalid",
    );
  });

  test("more than 20 rois fails", () => {
    const many = Array.from({ length: 21 }, (_, i) => roi({ id: `r-${i}` }));
    expect(
      validateGeometryConfig(config({ rois: many })).map((i) => i.code),
    ).toContain("rois_too_many");
  });

  test("more than 20 lines fails", () => {
    const many = Array.from({ length: 21 }, (_, i) => line({ id: `l-${i}` }));
    expect(
      validateGeometryConfig(config({ lines: many })).map((i) => i.code),
    ).toContain("lines_too_many");
  });

  test("duplicate ROI ids fail", () => {
    const c = config({ rois: [roi({ id: "dup" }), roi({ id: "dup" })] });
    expect(validateGeometryConfig(c).map((i) => i.code)).toContain(
      "roi_id_duplicate",
    );
  });

  test("duplicate line ids fail", () => {
    const c = config({
      lines: [line({ id: "dup" }), line({ id: "dup" })],
    });
    expect(validateGeometryConfig(c).map((i) => i.code)).toContain(
      "line_id_duplicate",
    );
  });

  test("ROI and line sharing the same id is allowed (separate namespaces)", () => {
    const c = config({
      rois: [roi({ id: "shared" })],
      lines: [line({ id: "shared" })],
    });
    expect(validateGeometryConfig(c)).toEqual([]);
  });

  test("non-object config fails fast", () => {
    expect(validateGeometryConfig(null)[0].code).toBe("config_not_object");
    expect(validateGeometryConfig("nope")[0].code).toBe("config_not_object");
  });

  test("missing frame fails", () => {
    const { frame: _drop, ...withoutFrame } = config();
    void _drop;
    expect(
      validateGeometryConfig(withoutFrame).map((i) => i.code),
    ).toContain("frame_not_object");
  });

  test("empty config (no shapes) passes when shape arrays are []", () => {
    expect(
      validateGeometryConfig(config({ rois: [], lines: [] })),
    ).toEqual([]);
  });
});

describe("createGeometryValidationSummary", () => {
  test("empty issues → ok", () => {
    const s = createGeometryValidationSummary([]);
    expect(s.ok).toBe(true);
    expect(s.errorCount).toBe(0);
    expect(s.warningCount).toBe(0);
    expect(s.firstError).toBeUndefined();
  });

  test("aggregates errors and warnings, exposes firstError", () => {
    const issues = [
      { code: "a", message: "first error", severity: "error" as const },
      { code: "b", message: "warning", severity: "warning" as const },
      { code: "c", message: "second error", severity: "error" as const },
    ];
    const s = createGeometryValidationSummary(issues);
    expect(s.ok).toBe(false);
    expect(s.errorCount).toBe(2);
    expect(s.warningCount).toBe(1);
    expect(s.firstError?.message).toBe("first error");
  });
});

describe("GEOMETRY_LIMITS", () => {
  test("mirrors api-server constants", () => {
    expect(GEOMETRY_LIMITS.maxShapes).toBe(20);
    expect(GEOMETRY_LIMITS.minRoiPoints).toBe(3);
    expect(GEOMETRY_LIMITS.maxRoiPoints).toBe(64);
    expect(GEOMETRY_LIMITS.lineExactPoints).toBe(2);
    expect(GEOMETRY_LIMITS.maxLabelLen).toBe(80);
    expect(GEOMETRY_LIMITS.schemaVersion).toBe(1);
    expect(GEOMETRY_LIMITS.coordinateSpace).toBe("normalized");
    expect(GEOMETRY_LIMITS.slugPattern.source).toBe(
      "^[a-z0-9][a-z0-9-]{0,63}$",
    );
  });
});
