// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { CameraProcessingConfig, ModelRegistryEntry } from "@/lib/api/types";

// The panel imports a "use server" action, useRouter, and the sonner toast —
// none of which work in a unit environment. Stub them so the client component
// renders in jsdom. This file covers RENDER smoke (model <select> options, the
// class checklist, the All-supported toggle, the M6 tracker/confidence/FPS
// controls, and the not-live-yet notice) plus a light SAVE-PAYLOAD assertion:
// the mocked Server Action receives a FormData whose `config` JSON reflects the
// chosen / defaulted M6 values. The validator's own bounds are covered in
// processing-config-schema.test.ts.
const saveProcessingConfigAction = vi.fn((form: FormData) => {
  void form;
  return Promise.resolve({
    ok: true as const,
    message: "Detection config saved.",
    record: {},
  });
});
vi.mock(
  "@/app/(dash)/(app)/(fleet)/cameras/[cameraId]/configure/detection/actions",
  () => ({
    saveProcessingConfigAction: (form: FormData) =>
      saveProcessingConfigAction(form),
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
  saveProcessingConfigAction.mockClear();
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
    supported_trackers: ["nvdcf", "iou"],
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

// Parse the `config` field of the FormData handed to the most recent save call.
function lastSavedConfig(): CameraProcessingConfig {
  const calls = saveProcessingConfigAction.mock.calls;
  const form = calls[calls.length - 1]?.[0] as FormData;
  return JSON.parse(String(form.get("config"))) as CameraProcessingConfig;
}

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
    const select = screen.getByRole("combobox", { name: "Model" });
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

  test("renders the read-only registry-facts note in the model info tile", () => {
    // The old note mentioned "M6"; it was replaced with this copy.
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    expect(
      screen.getByText(/These are read-only registry facts\./),
    ).toBeTruthy();
  });

  test("renders the verbatim not-live-yet notice as a role=note tile", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    const note = screen.getByRole("note");
    // textContent decodes the HTML entities (&amp; / &rsquo;) to their glyphs.
    expect(note.textContent).toContain(
      "This saves the intended model & detection config for this camera. " +
        "Live processor consumption isn’t enabled yet — runtime " +
        "behavior is unchanged until the processor-config milestone.",
    );
  });
});

describe("ModelDetectionPanel — M6 controls render", () => {
  test("renders the tracker, confidence, and FPS controls", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    expect(screen.getByRole("combobox", { name: "Tracker" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Processing FPS" })).toBeTruthy();
    expect(
      screen.getByRole("slider", { name: "Confidence threshold" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("spinbutton", { name: "Confidence threshold value" }),
    ).toBeTruthy();
  });

  test("tracker options are the model's supported_trackers plus 'Runtime default'", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    const tracker = screen.getByRole("combobox", { name: "Tracker" });
    const labels = within(tracker)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual(["Runtime default", "nvdcf", "iou"]);
  });

  test("FPS options are 'Default' plus the FPS_OPTIONS list", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    const fps = screen.getByRole("combobox", { name: "Processing FPS" });
    const labels = within(fps)
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual([
      "Default",
      "1 FPS",
      "2 FPS",
      "5 FPS",
      "10 FPS",
      "15 FPS",
      "30 FPS",
    ]);
  });

  test("a null confidence leaves the number input empty and 'Use default' disabled", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config({ confidence_threshold: null })}
        isDefault={true}
      />,
    );
    const number = screen.getByRole("spinbutton", {
      name: "Confidence threshold value",
    }) as HTMLInputElement;
    expect(number.value).toBe("");
    const useDefault = screen.getByRole("button", {
      name: "Use default",
    }) as HTMLButtonElement;
    expect(useDefault.disabled).toBe(true);
  });
});

describe("ModelDetectionPanel — save payload", () => {
  test("defaults: an unchanged config saves [] classes and null M6 fields", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    // A save needs a dirty edit; toggling FPS to Default-from-Default isn't a
    // change, so nudge then reset FPS to keep every field at its default but
    // mark dirty. Use the All-supported toggle off→on round-trip instead.
    const allToggle = screen.getByRole("checkbox", {
      name: /All supported classes/i,
    });
    fireEvent.click(allToggle); // off → subset (empty) ...
    fireEvent.click(allToggle); // ... back on → dirty, still "all supported"

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    const saved = lastSavedConfig();
    expect(saved.selected_classes).toEqual([]);
    expect(saved.tracker).toBeNull();
    expect(saved.confidence_threshold).toBeNull();
    expect(saved.processing_fps).toBeNull();
    expect(saved.model_key).toBe("yolo-v8");
    expect(saved.version).toBe(1);
  });

  test("set values: tracker, confidence, and FPS ride as real values", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config()}
        isDefault={true}
      />,
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Tracker" }), {
      target: { value: "iou" },
    });
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Confidence threshold value" }),
      { target: { value: "0.55" } },
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Processing FPS" }), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    const saved = lastSavedConfig();
    expect(saved.tracker).toBe("iou");
    expect(saved.confidence_threshold).toBe(0.55);
    expect(saved.processing_fps).toBe(10);
  });

  test("cleared back to default: tracker/FPS to default option and confidence via 'Use default' ride as null", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config({
          tracker: "iou",
          confidence_threshold: 0.55,
          processing_fps: 10,
        })}
        isDefault={false}
      />,
    );
    // Selecting the first option (value="") clears tracker / FPS to null.
    fireEvent.change(screen.getByRole("combobox", { name: "Tracker" }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Processing FPS" }), {
      target: { value: "" },
    });
    // "Use default" sets confidence to null.
    fireEvent.click(screen.getByRole("button", { name: "Use default" }));

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    const saved = lastSavedConfig();
    expect(saved.tracker).toBeNull();
    expect(saved.confidence_threshold).toBeNull();
    expect(saved.processing_fps).toBeNull();
  });

  test("selected_classes [] still means 'all supported' on save", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config({ selected_classes: ["person"] })}
        isDefault={false}
      />,
    );
    // Turn ON "All supported classes" → the saved subset becomes [].
    fireEvent.click(
      screen.getByRole("checkbox", { name: /All supported classes/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    expect(lastSavedConfig().selected_classes).toEqual([]);
  });

  test("a checked subset saves exactly those class names", () => {
    render(
      <ModelDetectionPanel
        cameraId="cam-1"
        models={MODELS}
        initialConfig={config({ selected_classes: [] })}
        isDefault={true}
      />,
    );
    // Turn OFF "All supported", then check "car".
    fireEvent.click(
      screen.getByRole("checkbox", { name: /All supported classes/i }),
    );
    const carLabel = screen.getByText("car").closest("label");
    const carBox = carLabel?.querySelector(
      "input[type=checkbox]",
    ) as HTMLInputElement;
    fireEvent.click(carBox);

    fireEvent.click(screen.getByRole("button", { name: /Save/ }));

    expect(lastSavedConfig().selected_classes).toEqual(["car"]);
  });
});
