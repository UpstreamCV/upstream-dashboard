import { describe, expect, test } from "vitest";
import {
  DEMO_COOKIE_MAX_AGE_SECONDS,
  demoCookieOptions,
  demoModeFromCookie,
  inferSecure,
} from "./demo-mode";

describe("demoModeFromCookie", () => {
  test("only the exact cookie value turns demo mode on (no build flag in tests)", () => {
    expect(demoModeFromCookie("1")).toBe(true);
    expect(demoModeFromCookie("0")).toBe(false);
    expect(demoModeFromCookie("true")).toBe(false);
    expect(demoModeFromCookie(undefined)).toBe(false);
  });
});

describe("inferSecure", () => {
  test("trusts X-Forwarded-Proto first (Netlify / any reverse proxy)", () => {
    expect(inferSecure("https", "localhost:3000")).toBe(true);
    expect(inferSecure("https, http", "dashboard.upstreamcv.com")).toBe(true);
    expect(inferSecure("http", "dashboard.upstreamcv.com")).toBe(false);
  });
  test("falls back to the URL scheme, then treats localhost as insecure", () => {
    expect(inferSecure(null, "localhost:3000", "http:")).toBe(false);
    expect(inferSecure(null, "127.0.0.1:3000", "http:")).toBe(false);
    expect(inferSecure(null, "example.com", "https:")).toBe(true);
    expect(inferSecure(null, "example.com", "http:")).toBe(false);
    expect(inferSecure(null, "example.com")).toBe(true);
  });
});

describe("demoCookieOptions", () => {
  test("cross-site (framed) cookies are SameSite=None; Secure; Partitioned over https", () => {
    expect(demoCookieOptions(true)).toEqual({
      path: "/",
      sameSite: "none",
      secure: true,
      maxAge: DEMO_COOKIE_MAX_AGE_SECONDS,
      partitioned: true,
    });
  });
  test("plain http (local next start) falls back to Lax without Partitioned", () => {
    expect(demoCookieOptions(false)).toMatchObject({
      sameSite: "lax",
      secure: false,
      partitioned: false,
    });
  });
  test("clearing keeps the same attributes with maxAge 0", () => {
    expect(demoCookieOptions(true, 0)).toMatchObject({
      sameSite: "none",
      secure: true,
      partitioned: true,
      maxAge: 0,
    });
  });
});
