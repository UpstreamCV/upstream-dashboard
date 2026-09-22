// Maps a `/v1/*` request (path + query + method + body) and the scene to the
// fixture the real wrapper expects. The single place every demo-mode call
// resolves through: serverFetch (RSC + Server Actions) and the catch-all proxy
// (client polling) both call this.
//
// IMPORTANT: return the upstream RESPONSE envelope, not the unwrapped value —
// e.g. `/v1/cameras` returns `{ cameras: [...] }` because listCameras() unwraps
// `.cameras`. List endpoints wrap; `/{id}` endpoints return the bare object.
//
// Reads are pure functions of (path, scene) — same scene → same pixels — with
// the in-memory write store (./state.ts) layered on top so writes made during a
// demo session (mark read, toggle a rule, create a token…) show up on the next
// read. Writes never reach a backend.

import type {
  ApiToken,
  ApiTokenCreated,
  Camera,
  ConfidenceTrendRange,
  ProcessingEvidenceRange,
  Rule,
  Workflow,
} from "@/lib/api/types";
import type { DemoScene } from "./scene";
import {
  ACCOUNT_ID,
  CAMERA_ID,
  USER_ID,
  demoAccount,
  demoAgent,
  demoAlerts,
  demoAuditLogs,
  demoCamera,
  demoCameraPackageConfig,
  demoCameraProcessingConfig,
  demoCameras,
  demoCollectorStatus,
  demoConfidenceTrend,
  demoDashboardSummary,
  demoFleetTrend,
  demoFindings,
  demoGeometryConfig,
  demoHeartbeats,
  demoLatestFrame,
  demoLimits,
  demoModels,
  demoObservations,
  demoPerception,
  demoProcessingConfig,
  demoProcessingEvidence,
  demoProcessingPackages,
  demoProcessorStatus,
  demoReliabilitySources,
  demoReliabilitySummary,
  demoRules,
  demoSession,
  demoTokens,
  demoUsageSummary,
  demoValidations,
  demoWorkflowRuns,
  demoWorkflows,
} from "./fixtures";
import {
  createItem,
  deleteItem,
  getDemoState,
  materialize,
  patchItem,
} from "./state";

type Query = Record<string, string | number | undefined> | undefined;

/** The write half of a request. Absent (or GET) = a read. */
export interface DemoRequest {
  method?: string;
  body?: unknown;
}

const nowIso = () => new Date().toISOString();

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(query: Query, key: string): string | undefined {
  const v = query?.[key];
  return v === undefined ? undefined : String(v);
}

function limit(query: Query, fallback = 100): number {
  const n = Number(str(query, "limit"));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Ids for items created during a session — unique per process, obviously fake
// (uuid-shaped so id-slicing UI code keeps working).
let created = 0;
function newId(prefix: string): string {
  created += 1;
  const tail = (Date.now().toString(16) + String(created).padStart(4, "0")).slice(-12);
  return `${prefix}0000000-0000-4000-8000-${tail}`;
}

export function resolveDemoResponse(
  rawPath: string,
  query: Query,
  scene: DemoScene,
  request: DemoRequest = {},
): unknown {
  const path = rawPath.split("?")[0].replace(/\/+$/, "");
  const seg = path.split("/").filter(Boolean); // e.g. ["v1","cameras","<id>","reliability","summary"]
  const method = (request.method ?? "GET").toUpperCase();
  const body = asRecord(request.body);
  const state = getDemoState();

  // --- account-level collections (read + write) -------------------------------

  const rules = () => materialize(demoRules(scene), state.rules);
  const workflows = () => materialize(demoWorkflows(scene), state.workflows);
  const alerts = () => materialize(demoAlerts(scene), state.alerts);
  const tokens = () => materialize(demoTokens.tokens, state.tokens);
  const cameras = () => materialize(demoCameras(scene), state.cameras);

  if (path === "/v1/usage/summary") {
    return demoUsageSummary(scene, {
      rules: rules().length,
      workflows: workflows().length,
      alerts: alerts().length,
      workflowRuns: demoWorkflowRuns(scene).length,
    });
  }

  if (path === "/v1/alerts") {
    const status = str(query, "status");
    const cameraId = str(query, "camera_id");
    return {
      alerts: alerts()
        .filter((a) => (status ? a.status === status : true))
        .filter((a) => (cameraId ? a.camera_id === cameraId : true))
        .slice(0, limit(query)),
    };
  }
  if (seg[1] === "alerts" && seg[2] && method === "POST") {
    const id = seg[2];
    if (seg[3] === "read") patchItem(state.alerts, id, { read_at: nowIso() });
    if (seg[3] === "resolve") {
      const current = alerts().find((a) => a.id === id);
      patchItem(state.alerts, id, {
        status: "resolved",
        resolved_at: nowIso(),
        read_at: current?.read_at ?? nowIso(),
      });
    }
    return alerts().find((a) => a.id === id) ?? {};
  }

  if (path === "/v1/rules") {
    if (method === "POST") {
      const at = nowIso();
      return createItem<Rule>(state.rules, {
        id: newId("b"),
        camera_id: String(body.camera_id ?? CAMERA_ID),
        name: String(body.name ?? "New rule"),
        rule_type: String(body.rule_type ?? "line_crossing"),
        enabled: true,
        config: asRecord(body.config),
        severity: String(body.severity ?? "warning"),
        cooldown_seconds: Number(body.cooldown_seconds ?? 300),
        created_by: USER_ID,
        created_at: at,
        updated_at: at,
      });
    }
    const cameraId = str(query, "camera_id");
    return {
      rules: rules().filter((r) => (cameraId ? r.camera_id === cameraId : true)),
    };
  }
  if (seg[1] === "rules" && seg[2]) {
    const id = seg[2];
    if (method === "PATCH") {
      patchItem(state.rules, id, { ...pickRuleFields(body), updated_at: nowIso() });
    }
    if (method === "DELETE") {
      deleteItem(state.rules, id);
      return undefined;
    }
    return rules().find((r) => r.id === id) ?? {};
  }

  if (path === "/v1/workflows") {
    if (method === "POST") {
      const at = nowIso();
      return createItem<Workflow>(state.workflows, {
        id: newId("e"),
        camera_id: String(body.camera_id ?? CAMERA_ID),
        name: String(body.name ?? "New workflow"),
        description: typeof body.description === "string" ? body.description : null,
        workflow_type: String(body.workflow_type ?? "sequence"),
        enabled: true,
        config: asRecord(body.config),
        severity: String(body.severity ?? "warning"),
        cooldown_seconds: Number(body.cooldown_seconds ?? 600),
        created_by: USER_ID,
        created_at: at,
        updated_at: at,
      });
    }
    const cameraId = str(query, "camera_id");
    const type = str(query, "type");
    return {
      workflows: workflows()
        .filter((w) => (cameraId ? w.camera_id === cameraId : true))
        .filter((w) => (type ? w.workflow_type === type : true)),
    };
  }
  if (seg[1] === "workflows" && seg[2]) {
    const id = seg[2];
    if (method === "PATCH") {
      patchItem(state.workflows, id, { ...pickRuleFields(body), updated_at: nowIso() });
    }
    if (method === "DELETE") {
      deleteItem(state.workflows, id);
      return undefined;
    }
    return workflows().find((w) => w.id === id) ?? {};
  }

  if (path === "/v1/workflow-runs") {
    const status = str(query, "status");
    const cameraId = str(query, "camera_id");
    const ruleId = str(query, "rule_id");
    return {
      runs: demoWorkflowRuns(scene)
        .filter((r) => (status ? r.status === status : true))
        .filter((r) => (cameraId ? r.camera_id === cameraId : true))
        .filter((r) => (ruleId ? r.rule_id === ruleId : true))
        .sort((a, b) => b.started_at.localeCompare(a.started_at))
        .slice(0, limit(query)),
    };
  }
  if (seg[1] === "workflow-runs" && seg[2]) {
    return demoWorkflowRuns(scene).find((r) => r.id === seg[2]) ?? {};
  }

  if (path === "/v1/audit-logs") {
    const eventType = str(query, "event_type");
    const resourceType = str(query, "resource_type");
    const before = str(query, "before");
    return {
      items: demoAuditLogs(scene)
        .filter((i) => (eventType ? i.event_type === eventType : true))
        .filter((i) => (resourceType ? i.resource_type === resourceType : true))
        .filter((i) => (before ? i.created_at < before : true))
        .slice(0, limit(query)),
      next_cursor: null,
    };
  }

  if (path === "/v1/api-tokens") {
    if (method === "POST") {
      const at = nowIso();
      const id = newId("7");
      const secret = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
      const token = createItem<ApiToken>(state.tokens, {
        id,
        account_id: ACCOUNT_ID,
        name: String(body.name ?? "New token"),
        prefix: "ups_demo",
        last_four: secret.slice(-4),
        scopes: Array.isArray(body.scopes) ? body.scopes.map(String) : ["agent"],
        last_used_at: null,
        expires_at: typeof body.expires_at === "string" ? body.expires_at : null,
        revoked_at: null,
        created_at: at,
      });
      return { token, plaintext: `ups_demo_${id.slice(0, 8)}_${secret}` } satisfies ApiTokenCreated;
    }
    return { tokens: tokens() };
  }
  if (seg[1] === "api-tokens" && seg[2] && method === "DELETE") {
    patchItem(state.tokens, seg[2], { revoked_at: nowIso() });
    return undefined;
  }

  if (path === "/v1/account/processing-config") {
    if (method === "PATCH" && typeof body.processing_enabled === "boolean") {
      state.processingEnabled = body.processing_enabled;
    }
    return demoProcessingConfig(state.processingEnabled ?? true);
  }

  // Stripe-hosted pages don't exist in a demo; the Billing page hides the
  // buttons (management_available: false), this is just belt-and-braces.
  if (path === "/v1/billing/checkout" || path === "/v1/billing/portal") {
    return { url: "/billing" };
  }

  // --- Upstream Collector ------------------------------------------------------
  if (path === "/v1/reliability/collector-status") return demoCollectorStatus();
  if (path === "/v1/reliability/sources") return { sources: demoReliabilitySources() };
  if (path === "/v1/reliability/issues") return { issues: [] };
  if (seg[1] === "reliability" && seg[2] === "sources" && seg[3]) {
    return demoReliabilitySources()[0];
  }

  // --- top-level, exact matches -----------------------------------------------
  if (path === "/v1/dashboard/summary") return demoDashboardSummary(scene);
  if (path === "/v1/dashboard/fleet-trend") return demoFleetTrend(scene);
  if (path === "/v1/agents") return { agents: [demoAgent()] };
  if (path === "/v1/cameras") {
    if (method === "POST") {
      const at = nowIso();
      return createItem<Camera>(state.cameras, {
        ...demoCamera(),
        id: newId("c"),
        agent_id: null,
        name: String(body.name ?? "New camera"),
        external_id: null,
        device_path: String(body.device_path ?? "webcam:0"),
        source_type: String(body.source_type ?? "webcam"),
        default_width: Number(body.default_width ?? 1280),
        default_height: Number(body.default_height ?? 720),
        default_fps: Number(body.default_fps ?? 30),
        default_bitrate_kbps: Number(body.default_bitrate_kbps ?? 3000),
        metadata: {},
        status: "idle",
        created_at: at,
        updated_at: at,
      });
    }
    return { cameras: cameras() };
  }
  if (path === "/v1/account") return demoAccount;
  if (path === "/v1/account/limits") return demoLimits;
  if (path === "/v1/models") return demoModels();
  if (path === "/v1/processing/packages") return demoProcessingPackages();
  if (path === "/v1/stream-sessions") return { sessions: [demoSession()] };

  // /v1/agents/{id}[/heartbeats]
  if (seg[1] === "agents" && seg[2]) {
    if (seg[3] === "heartbeats") {
      return { heartbeats: demoHeartbeats(scene, Math.min(limit(query, 12), 50)) };
    }
    return demoAgent();
  }

  // /v1/stream-sessions/{id}[/...]
  if (seg[1] === "stream-sessions" && seg[2]) {
    if (seg[3] === "validations") return { validations: demoValidations };
    if (seg[3] === "whep") return null; // bypassed — player swaps to <DemoVideo>
    return demoSession();
  }

  // /v1/cameras/{id}[/...]
  if (seg[1] === "cameras" && seg[2]) {
    const id = seg[2];
    const sub = seg.slice(3).join("/");
    switch (sub) {
      case "": {
        if (method === "PATCH") {
          patchItem(state.cameras, id, { ...pickCameraFields(body), updated_at: nowIso() });
        }
        // The narrative camera resolves even before it is in the list (its
        // detail deep-link must work at `adding`); created cameras resolve
        // from the store.
        return (
          cameras().find((c) => c.id === id) ??
          (id === CAMERA_ID ? demoCamera() : {})
        );
      }
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
      // The config-aware trend + comparison cards are hidden in demo mode; a
      // null here lets their wrappers' "unavailable" posture stand.
      case "reliability/confidence-trend/by-config":
      case "reliability/config-comparison-summary":
        return null;
    }
  }

  // Unknown path: empty-but-safe so a stray poll never 500s on camera.
  return {};
}

// Whitelist the editable fields of a rule/workflow PATCH.
function pickRuleFields(body: Record<string, unknown>): Partial<Rule> {
  const out: Partial<Rule> = {};
  if (typeof body.name === "string") out.name = body.name;
  if (typeof body.enabled === "boolean") out.enabled = body.enabled;
  if (typeof body.severity === "string") out.severity = body.severity;
  if (typeof body.cooldown_seconds === "number") out.cooldown_seconds = body.cooldown_seconds;
  if (body.config !== undefined) out.config = asRecord(body.config);
  return out;
}

function pickCameraFields(body: Record<string, unknown>): Partial<Camera> {
  const out: Partial<Camera> = {};
  if (typeof body.name === "string") out.name = body.name;
  if (typeof body.source_type === "string") out.source_type = body.source_type;
  if (typeof body.device_path === "string") out.device_path = body.device_path;
  for (const key of [
    "default_width",
    "default_height",
    "default_fps",
    "default_bitrate_kbps",
  ] as const) {
    if (typeof body[key] === "number") out[key] = body[key];
  }
  return out;
}
