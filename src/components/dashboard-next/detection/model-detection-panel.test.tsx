// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { CameraProcessingConfig, ModelRegistryEntry } from "@/lib/api/types";

// The panel imports a "use server" action, useRouter, and the sonner toast —
// none of which work in a unit environment. Stub them so the client component
// renders in jsdom. This is a focused RENDER smoke test (model <select>
// options, the class checklist, and the initial All-supported toggle state);
// full save/interaction flow is integration territory and intentionally not
// exercised here (the action + validator are covered by their own tests).
vi.mock(
  "@/app/dashboard/(app)/cameras/[cameraId]/configure/detection/actions",
  () => ({
    saveProcessingConfigAction: vi.fn(async () => ({
      ok: true,
      message: "Detection config saved.",
      record: {},
    })),
  }),
);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ModelDetectionPanel } from "./model-detection-panel";

afterEach(() => {
  cleanup();
});

function model(over: Partial<ModelRegistryEntry> = {}): ModelRegistryEntry {
  return {
    model_key: "yolo-v8",
    display_name: "YOLO v8",
    description: null,
    task_type: "detection",
    runtime: "deepstream",
    default_confidence_threshold: 0.4,
    supported_classes: ["person", "car", "truck"],
    supported_trackers: ["nvdcf"],
    model_version: null,
    detector_version: null,
    resource_profile: null,
    enabled: true,
    notes: null,
    limitations: null,
    ...over,
  };
}

function config(
  over: Partial<CameraProcessingConfig> = {},
): CameraProcessingConfig {
  return {
    version: 1,
    model_key: "yolo-v8",
    selected_classes: [],
    tracker: null,
    confidence_threshold: null,
    processing_fps: null,
    ...over,
  };
}

const MODELS = [model(), model({ model_key: "rtdetr", display_name: "RT-DETR" })];

describe("ModelDetectionPanel — render smoke", () => {
  test("renders model display names as <select> options", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    const select = screen.getByRole("combobox");
    const options = within(select).getAllByRole("option");
    const labels = options.map((o) => o.textContent);
    expect(labels).toContain("YOLO v8");
    expect(labels).toContain("RT-DETR");
  });

  test("disabled models render as a disabled option with a (disabled) suffix", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={[model(), model({ model_key: "old", display_name: "Old", enabled: false })]}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    const disabled = screen.getByRole("option", {
      name: "Old (disabled)",
    }) as HTMLOptionElement;
    expect(disabled.disabled).toBe(true);
  });

  test("shows the selected model's supported_classes in the checklist", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    expect(screen.getByText("person")).toBeTruthy();
    expect(screen.getByText("car")).toBeTruthy();
    expect(screen.getByText("truck")).toBeTruthy();
  });

  test("'All supported classes' toggle is ON when initial selected_classes is empty", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config({ selected_classes: [] })}
        isDefault={true}
      />,
    );
    const toggle = screen.getByRole("checkbox", {
      name: /All supported classes/i,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  test("'All supported classes' toggle is OFF and the saved subset is pre-checked", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config({ selected_classes: ["person"] })}
        isDefault={false}
      />,
    );
    const toggle = screen.getByRole("checkbox", {
      name: /All supported classes/i,
    }) as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    // The class checkboxes are the unnamed siblings; find the one paired with
    // the "person" label text.
    const personLabel = screen.getByText("person").closest("label");
    const personBox = personLabel?.querySelector(
      "input[type=checkbox]",
    ) as HTMLInputElement;
    expect(personBox.checked).toBe(true);

    const carLabel = screen.getByText("car").closest("label");
    const carBox = carLabel?.querySelector(
      "input[type=checkbox]",
    ) as HTMLInputElement;
    expect(carBox.checked).toBe(false);
  });

  test("renders the M6 deferral note in the model info tile", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    expect(screen.getByText(/M6/)).toBeTruthy();
  });
});
