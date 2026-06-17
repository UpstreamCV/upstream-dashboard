import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

// The toggle component imports a Server Action from the settings page
// directory. Server Actions can't be exercised in a unit test environment,
// so stub the module here. The component just needs the function to exist
// and be callable; behavior under success / failure is integration territory.
vi.mock("@/app/(dash)/(app)/(account)/settings/actions", () => ({
  setProcessingEnabled: vi.fn(async () => ({ ok: true })),
}));

import { ProcessingToggleNext } from "./processing-toggle-next";

describe("ProcessingToggleNext", () => {
  test("renders with processing ON when initialEnabled=true", () => {
    const html = renderToStaticMarkup(
      <ProcessingToggleNext initialEnabled={true} />,
    );
    expect(html).toContain("Processing");
    expect(html).toContain("processing on");
    // Operator-facing copy explains what OFF does.
    expect(html).toContain("processor analyses frames");
    expect(html).toContain('aria-checked="true"');
  });

  test("renders with processing OFF when initialEnabled=false", () => {
    const html = renderToStaticMarkup(
      <ProcessingToggleNext initialEnabled={false} />,
    );
    expect(html).toContain("processing off");
    expect(html).toContain('aria-checked="false"');
  });

  test("does not leak runtime-internal jargon to operator copy", () => {
    // Same posture as the reliability-panel "no jargon" guard. Operators
    // shouldn't see DeepStream / nvdsanalytics / GStreamer / pyds in
    // settings copy any more than in reliability copy.
    const html = renderToStaticMarkup(
      <ProcessingToggleNext initialEnabled={true} />,
    ).toLowerCase();
    expect(html).not.toContain("deepstream");
    expect(html).not.toContain("nvdsanalytics");
    expect(html).not.toContain("gstreamer");
    expect(html).not.toContain("pyds");
  });
});
