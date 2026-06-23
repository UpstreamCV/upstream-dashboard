import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { CollectorSetupCard } from "./collector-setup-card";

describe("CollectorSetupCard", () => {
  const html = renderToStaticMarkup(<CollectorSetupCard />);

  test("shows the local endpoint and start command", () => {
    expect(html).toContain("collector start");
    expect(html).toContain("http://127.0.0.1:8756/v1/observations");
  });

  test("includes curl, python, and detection_summary examples", () => {
    expect(html).toContain("curl -X POST");
    expect(html).toContain("import requests");
    expect(html).toContain("detection_summary");
  });

  test("contains no API token", () => {
    expect(html).not.toContain("ups_");
    expect(html.toLowerCase()).not.toContain("authorization");
    expect(html.toLowerCase()).not.toContain("bearer");
  });
});
