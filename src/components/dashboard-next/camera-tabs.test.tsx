// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { pathname } = vi.hoisted(() => ({
  pathname: { current: "/cameras/cam-1/monitor" },
}));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CameraTabs } from "./camera-tabs";

afterEach(cleanup);

describe("CameraTabs", () => {
  test("includes a Processing tab linking to the processing route", () => {
    pathname.current = "/cameras/cam-1/monitor";
    render(<CameraTabs cameraId="cam-1" />);
    const link = screen.getByRole("link", { name: "Processing" });
    expect(link.getAttribute("href")).toBe("/cameras/cam-1/processing");
  });

  test("marks Processing active when on its route", () => {
    pathname.current = "/cameras/cam-1/processing";
    render(<CameraTabs cameraId="cam-1" />);
    expect(
      screen
        .getByRole("link", { name: "Processing" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  // Command Center was consolidated into Live Monitor, which is now both the
  // first tab and the bare root's redirect target.
  test("no longer offers a Command Center tab", () => {
    pathname.current = "/cameras/cam-1/monitor";
    render(<CameraTabs cameraId="cam-1" />);
    expect(screen.queryByRole("link", { name: "Command Center" })).toBeNull();
  });

  test("marks Live Monitor active on the bare camera root", () => {
    pathname.current = "/cameras/cam-1";
    render(<CameraTabs cameraId="cam-1" />);
    expect(
      screen
        .getByRole("link", { name: "Live Monitor" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
