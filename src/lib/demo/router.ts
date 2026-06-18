// Maps a `/v1/*` request path + scene to the fixture the real wrapper expects.
// The single place every demo-mode read resolves through: serverFetch (RSC +
// Server Actions) and the catch-all proxy (client polling) both call this.
//
// IMPORTANT: return the upstream RESPONSE envelope, not the unwrapped value —
// e.g. `/v1/cameras` returns `{ cameras: [...] }` because listCameras() unwraps
// `.cameras`. List endpoints wrap; `/{id}` endpoints return the bare object.

import type {
  ConfidenceTrendRange,
  ProcessingEvidenceRange,
} from "@/lib/api/types";
import type { DemoScene } from "./scene";
import {
  demoAccount,
  demoAgent,
  demoCamera,
  demoCameraPackageConfig,
  demoCameraProcessingConfig,
  demoCameras,
  demoConfidenceTrend,
  demoDashboardSummary,
  demoFindings,
  demoGeometryConfig,
  demoLatestFrame,
  demoLimits,
  demoModels,
  demoObservations,
  demoPerception,
  demoProcessingConfig,
  demoProcessingEvidence,
  demoProcessingPackages,
  demoProcessorStatus,
  demoReliabilitySummary,
  demoSession,
  demoTokens,
  demoValidations,
} from "./fixtures";

type Query = Record<string, string | number | undefined> | undefined;

export function resolveDemoResponse(
  rawPath: string,
  query: Query,
  scene: DemoScene,
): unknown {
  const path = rawPath.split("?")[0].replace(/\/+$/, "");
  const seg = path.split("/").filter(Boolean); // e.g. ["v1","cameras","<id>","reliability","summary"]

  // Top-level, exact matches first.
  if (path === "/v1/dashboard/summary") return demoDashboardSummary(scene);
  if (path === "/v1/agents") return { agents: [demoAgent()] };
  if (path === "/v1/cameras") return { cameras: demoCameras(scene) };
  if (path === "/v1/api-tokens") return demoTokens;
  if (path === "/v1/account") return demoAccount;
  if (path === "/v1/account/limits") return demoLimits;
  if (path === "/v1/account/processing-config") return demoProcessingConfig;
  if (path === "/v1/models") return demoModels();
  if (path === "/v1/processing/packages") return demoProcessingPackages();
  if (path === "/v1/stream-sessions") return { sessions: [demoSession()] };

  if (seg[1] === "agents" && seg[2]) return demoAgent(); // /v1/agents/{id}

  // /v1/stream-sessions/{id}[/...]
  if (seg[1] === "stream-sessions" && seg[2]) {
    if (seg[3] === "validations") return { validations: demoValidations };
    if (seg[3] === "whep") return null; // bypassed — player swaps to <DemoVideo>
    return demoSession();
  }

  // /v1/cameras/{id}[/...]
  if (seg[1] === "cameras" && seg[2]) {
    const sub = seg.slice(3).join("/");
    switch (sub) {
      case "":
        return demoCamera();
      case "latest-frame":
        return demoLatestFrame();
      case "geometry-config":
        return { geometry_config: demoGeometryConfig(scene) };
      case "processing-config":
        return demoCameraProcessingConfig();
      case "processing-config/package":
      case "processing-config/apply":
        return demoCameraPackageConfig();
      case "processing/evidence": {
        const range: ProcessingEvidenceRange =
          query?.range === "1h" ? "1h" : "24h";
        return demoProcessingEvidence(scene, range);
      }
      case "perception/latest":
        return demoPerception(scene);
      case "processor-status/latest":
        return { status: demoProcessorStatus(scene) };
      case "observations/recent":
        return demoObservations(scene);
      case "reliability/summary":
        return demoReliabilitySummary(scene);
      case "reliability/findings": {
        const status = typeof query?.status === "string" ? query.status : undefined;
        return demoFindings(scene, status);
      }
      case "reliability/confidence-trend": {
        const range: ConfidenceTrendRange = query?.range === "7d" ? "7d" : "24h";
        return demoConfidenceTrend(scene, range);
      }
    }
  }

  // Unknown path: empty-but-safe so a stray poll never 500s on camera.
  return {};
}
