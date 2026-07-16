import { AppliedGeometryPanel } from "@/components/dashboard-next/applied-geometry-panel";
import {
  AgentPanel,
  CameraMetaPanel,
  SessionPanel,
  ValidationPanel,
} from "@/components/dashboard-next/camera-panels";
import { LivePerceptionOverlayNext } from "@/components/dashboard-next/live-perception-overlay-next";
import { LiveStreamPanelNext } from "@/components/dashboard-next/live-stream-panel-next";
import { ReliabilityPanel } from "@/components/dashboard-next/reliability-panel";
import { getActiveAccount } from "@/lib/account/active";
import { getAgent } from "@/lib/api/agents";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import { getLatestPerception } from "@/lib/api/perception";
import { getProcessingConfig } from "@/lib/api/processing-config";
import { getLatestProcessorStatus } from "@/lib/api/processor-status";
import { getReliabilitySummary } from "@/lib/api/reliability";
import { getLatestFrame } from "@/lib/api/snapshots";
import { listStreamSessions } from "@/lib/api/stream-sessions";
import { listValidations } from "@/lib/api/validations";
import { notFound } from "next/navigation";
import type {
  Camera,
  ProcessorStatusRecord,
  ReliabilitySummary,
  StreamSession,
  StreamValidation,
} from "@/lib/api/types";

// Monitor tab — the camera's landing view. Live stream (with optional live
// perception overlay) or, when nothing is publishing, the last captured frame
// as a key image; plus the reliability verdict, session info, and the
// camera/agent/validation meta panels. The persistent header, status badge, and
// Realtime listener live one level up in layout.tsx.
//
// This tab absorbed the Command Center (./overview) tab, which composed the same
// panels minus the stream. That tab's one real contribution was giving the
// verdict panels a roomy 2/3 column rather than the narrow rail, so the
// reliability strip below spans full width.
//
// Re-fetches camera + current session so all data flows server-side without
// prop-drilling through the layout. With serverFetch using cache: "no-store"
// this is a duplicate upstream call versus the layout's; accepted for now.

export default async function CameraMonitorPage({
  params,
}: {
  params: Promise<{ cameraId: string }>;
}) {
  const { cameraId } = await params;
  const { activeAccountId } = await getActiveAccount();

  let camera: Camera;
  try {
    camera = await getCamera({ accountId: activeAccountId, cameraId });
  } catch (err) {
    if (err instanceof UpstreamApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const [
    agent,
    sessions,
    latestPerception,
    latestFrame,
    reliabilitySummary,
    processingConfig,
  ] = await Promise.all([
      // 404 = agent removed; other errors bubble to the segment error boundary.
      // agent_id is null for dashboard-created cameras no agent has claimed.
      camera.agent_id === null
        ? Promise.resolve(null)
        : getAgent({ accountId: activeAccountId, agentId: camera.agent_id }).catch(
            (err) => {
              if (err instanceof UpstreamApiError && err.status === 404) return null;
              throw err;
            },
          ),
      listStreamSessions({
        accountId: activeAccountId,
        cameraId: camera.id,
        limit: 1,
      }),
      // Seeds the live perception overlay's initial boxes.
      getLatestPerception({ accountId: activeAccountId, cameraId: camera.id }),
      // Key image behind the non-streaming states. Wrapper returns null on
      // snapshot_not_found, which is every camera until the streaming server's
      // snapshot uploader is enabled (UPSTREAM_SNAPSHOT_UPLOAD_ENABLED).
      getLatestFrame({ accountId: activeAccountId, cameraId: camera.id }),
      // Reliability M0/M1-A — evaluates on read in the api-server. Returns
      // null on 404 so an unavailable endpoint doesn't crash the tab.
      getReliabilitySummary({
        accountId: activeAccountId,
        cameraId: camera.id,
      }),
      // M3 master switch -> the live perception overlay shows a dedicated
      // "Enable processing in Settings" empty state when this is off. Fail
      // open (treat as enabled) on any error so an outage of this endpoint
      // doesn't disable the overlay surface.
      getProcessingConfig({ accountId: activeAccountId }).catch((err) => {
        if (err instanceof UpstreamApiError) return null;
        throw err;
      }),
    ]);
  const processingEnabled = processingConfig?.processing_enabled ?? true;
  // Local rebinding so the panel prop type stays narrow.
  const reliability: ReliabilitySummary | null = reliabilitySummary;

  const currentSession: StreamSession | null = sessions[0] ?? null;

  // Second-phase fetches that depend on `currentSession`. Run in parallel
  // among themselves so the per-page latency stays bounded by the slower
  // of the two.
  const [validations, processorStatus]: [
    StreamValidation[],
    ProcessorStatusRecord | null,
  ] = await Promise.all([
    currentSession
      ? listValidations({
          accountId: activeAccountId,
          sessionId: currentSession.id,
        }).catch((err) => {
          if (err instanceof UpstreamApiError && err.status === 404) return [];
          throw err;
        })
      : Promise.resolve([]),
    // P6-D Applied Geometry chip — narrow to the current session when one is
    // active so the chip reflects the running runtime, not the latest-ever
    // historical row. Wrapper returns null on processor_status_not_found.
    getLatestProcessorStatus({
      accountId: activeAccountId,
      cameraId: camera.id,
      streamSessionId: currentSession?.id,
    }),
  ]);
  const latestValidation = validations[0] ?? null;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Reliability leads, full width. Command Center gave the verdict a 2/3
          column; now that this tab is the landing view it gets the whole row
          rather than being squeezed into the rail beside the feed. */}
      <ReliabilityPanel summary={reliability} cameraId={camera.id} />

      {/* Live stream is the hero; runtime context sits beside it. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2">
          <LiveStreamPanelNext
            session={currentSession}
            latestFrame={latestFrame}
            renderStreaming={(session) => (
              <LivePerceptionOverlayNext
                sessionId={session.id}
                cameraId={session.camera_id}
                approved={session.approved}
                initialPerception={latestPerception}
                processingEnabled={processingEnabled}
              />
            )}
          />
        </div>
        <div className="space-y-4 md:space-y-6">
          <AppliedGeometryPanel status={processorStatus} />
          {currentSession ? <SessionPanel session={currentSession} /> : null}
        </div>
      </div>

      {/* Condensed details row. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        <AgentPanel agent={agent} />
        <CameraMetaPanel camera={camera} />
        <ValidationPanel validation={latestValidation} />
      </div>
    </div>
  );
}
