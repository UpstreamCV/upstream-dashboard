// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useLiveDetectionSession } from "./use-live-detection-session";

const MIN = 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-29T12:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useLiveDetectionSession", () => {
  test("defaults off", () => {
    const { result } = renderHook(() => useLiveDetectionSession());
    expect(result.current.status).toBe("off");
    expect(result.current.expiresAt).toBeNull();
    expect(result.current.remainingMs).toBe(0);
  });

  test("enable starts a 15-minute session", () => {
    const { result } = renderHook(() => useLiveDetectionSession());
    act(() => result.current.enable());
    expect(result.current.status).toBe("on");
    expect(result.current.remainingMs).toBe(15 * MIN);
  });

  test("countdown decreases as time advances", () => {
    const { result } = renderHook(() => useLiveDetectionSession());
    act(() => result.current.enable());
    act(() => {
      vi.advanceTimersByTime(MIN);
    });
    expect(result.current.status).toBe("on");
    expect(result.current.remainingMs).toBe(14 * MIN);
  });

  test("expires after 15 minutes", () => {
    const { result } = renderHook(() => useLiveDetectionSession());
    act(() => result.current.enable());
    act(() => {
      vi.advanceTimersByTime(15 * MIN + 1000);
    });
    expect(result.current.status).toBe("expired");
    expect(result.current.remainingMs).toBe(0);
  });

  test("disable turns off immediately", () => {
    const { result } = renderHook(() => useLiveDetectionSession());
    act(() => result.current.enable());
    act(() => result.current.disable());
    expect(result.current.status).toBe("off");
    expect(result.current.expiresAt).toBeNull();
  });

  test("extend resets the clock to a fresh 15 minutes", () => {
    const { result } = renderHook(() => useLiveDetectionSession());
    act(() => result.current.enable());
    act(() => {
      vi.advanceTimersByTime(10 * MIN);
    });
    expect(result.current.remainingMs).toBe(5 * MIN);
    act(() => result.current.extend());
    expect(result.current.status).toBe("on");
    expect(result.current.remainingMs).toBe(15 * MIN);
  });

  test("re-enable from expired starts a fresh session", () => {
    const { result } = renderHook(() => useLiveDetectionSession());
    act(() => result.current.enable());
    act(() => {
      vi.advanceTimersByTime(16 * MIN);
    });
    expect(result.current.status).toBe("expired");
    act(() => result.current.enable());
    expect(result.current.status).toBe("on");
    expect(result.current.remainingMs).toBe(15 * MIN);
  });
});
