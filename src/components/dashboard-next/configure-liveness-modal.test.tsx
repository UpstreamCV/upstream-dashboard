// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReliabilitySource } from "@/lib/api/types";

const { updateAction, toastSuccess, toastError } = vi.hoisted(() => ({
  updateAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(dash)/(app)/(fleet)/agents/collector/actions", () => ({
  updateSourceLivenessAction: updateAction,
}));
vi.mock("sonner", () => ({ toast: { success: toastSuccess, error: toastError } }));

import { ConfigureLivenessModal } from "./configure-liveness-modal";

function src(over: Partial<ReliabilitySource> = {}): ReliabilitySource {
  return {
    id: "s-1",
    source: "edge-box-4",
    external_camera_key: "dock-12",
    display_name: "dock-12",
    source_kind: "external_camera",
    first_seen_at: "2026-06-25T17:00:00Z",
    last_seen_at: "2026-06-25T18:00:00Z",
    last_observation_at: "2026-06-25T18:00:00Z",
    last_event_at: "2026-06-25T18:00:00Z",
    last_detection_summary_at: "2026-06-25T18:00:00Z",
    last_collector_heartbeat_at: null,
    last_config_changed_at: null,
    last_model_name: "detector-v1",
    last_model_version: "2026-06-22",
    observation_count_total: 1200,
    event_count_total: 80,
    detection_summary_count_total: 112,
    collector_heartbeat_count_total: 0,
    config_changed_count_total: 0,
    open_issue_count: 0,
    status_hint: "active",
    health_status: "healthy",
    health_reason: null,
    health_message: null,
    liveness_enabled: true,
    expected_interval_seconds: 600,
    liveness_grace_seconds: 300,
    last_liveness_checked_at: "2026-06-25T18:00:00Z",
    last_health_status_changed_at: "2026-06-25T18:00:00Z",
    liveness_silence_started_at: null,
    last_liveness_issue_id: null,
    ...over,
  };
}

function renderModal(over: Partial<ReliabilitySource> = {}) {
  const onConfigured = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <ConfigureLivenessModal
      source={src(over)}
      open
      onOpenChange={onOpenChange}
      onConfigured={onConfigured}
    />,
  );
  return { onConfigured, onOpenChange };
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  updateAction.mockResolvedValue({ ok: true, source: src() });
});
afterEach(cleanup);

describe("ConfigureLivenessModal", () => {
  test("shows source identity + current values pre-filled", () => {
    renderModal();
    expect(screen.getByText("edge-box-4")).toBeDefined();
    expect(screen.getByText("dock-12")).toBeDefined();
    expect(screen.getByText("External source")).toBeDefined();
    expect((screen.getByLabelText("Expected interval value") as HTMLInputElement).value).toBe("10");
    expect((screen.getByLabelText("Expected interval unit") as HTMLSelectElement).value).toBe("minutes");
    expect((screen.getByLabelText("Grace period value") as HTMLInputElement).value).toBe("5");
  });

  test("save sends only the changed expected interval (converted to seconds)", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Expected interval value"), {
      target: { value: "5" },
    });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith("s-1", { expected_interval_seconds: 300 }),
    );
  });

  test("converts hours to seconds", async () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Expected interval unit"), {
      target: { value: "hours" },
    });
    fireEvent.change(screen.getByLabelText("Expected interval value"), {
      target: { value: "1" },
    });
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith("s-1", { expected_interval_seconds: 3600 }),
    );
  });

  test("disabling monitoring sends only liveness_enabled=false", async () => {
    renderModal();
    fireEvent.click(screen.getByLabelText("Monitor this source"));
    fireEvent.click(saveButton());
    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith("s-1", { liveness_enabled: false }),
    );
  });

  test("reset to defaults sends null intervals", async () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Reset to defaults" }));
    await waitFor(() =>
      expect(updateAction).toHaveBeenCalledWith("s-1", {
        expected_interval_seconds: null,
        liveness_grace_seconds: null,
      }),
    );
  });

  test("an invalid expected interval blocks save", () => {
    renderModal();
    fireEvent.change(screen.getByLabelText("Expected interval value"), {
      target: { value: "0" },
    });
    expect(saveButton().disabled).toBe(true);
  });

  test("save is disabled until something changes", () => {
    renderModal();
    expect(saveButton().disabled).toBe(true);
  });

  test("success closes the modal and refreshes", async () => {
    const { onConfigured, onOpenChange } = renderModal();
    fireEvent.change(screen.getByLabelText("Expected interval value"), {
      target: { value: "5" },
    });
    fireEvent.click(saveButton());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onConfigured).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
  });

  test("failure keeps the modal open and shows the error", async () => {
    updateAction.mockResolvedValue({ ok: false, message: "Admin required." });
    const { onOpenChange } = renderModal();
    fireEvent.change(screen.getByLabelText("Expected interval value"), {
      target: { value: "5" },
    });
    fireEvent.click(saveButton());
    await waitFor(() => expect(screen.getByText("Admin required.")).toBeDefined());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  test("collector rows use heartbeat / offline wording", () => {
    renderModal({ source_kind: "collector", external_camera_key: null });
    expect(screen.getByText("Expected heartbeat every")).toBeDefined();
    expect(
      screen.getByText("Grace period before marking collector offline"),
    ).toBeDefined();
  });

  test("external rows use observation / silent wording", () => {
    renderModal();
    expect(screen.getByText("Expected observations every")).toBeDefined();
    expect(
      screen.getByText("Grace period before marking source silent"),
    ).toBeDefined();
  });
});
