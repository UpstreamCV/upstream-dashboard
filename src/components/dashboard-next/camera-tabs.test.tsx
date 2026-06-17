// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const { pathname } = vi.hoisted(() => ({
  pathname: { current: "/cameras/cam-1/overview" },
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
    pathname.current = "/cameras/cam-1/overview";
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
});
