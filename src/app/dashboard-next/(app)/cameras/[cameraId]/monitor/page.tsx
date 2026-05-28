import { AppliedGeometryPanel } from "@/components/dashboard-next/applied-geometry-panel";
import {
  AgentPanel,
  CameraMetaPanel,
  SessionPanel,
  ValidationPanel,
} from "@/components/dashboard-next/camera-panels";
import { LatestFrameCardNext } from "@/components/dashboard-next/latest-frame-card-next";
import { LatestFramePerceptionOverlayNext } from "@/components/dashboard-next/latest-frame-perception-overlay-next";
import { LivePerceptionOverlayNext } from "@/components/dashboard-next/live-perception-overlay-next";
import { LiveStreamPanelNext } from "@/components/dashboard-next/live-stream-panel-next";
import { getActiveAccount } from "@/lib/account/active";
import { getAgent } from "@/lib/api/agents";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import { getLatestPerception } from "@/lib/api/perception";
import { getLatestProcessorStatus } from "@/lib/api/processor-status";
import { getLatestFrame } from "@/lib/api/snapshots";
import { listStreamSessions } from "@/lib/api/stream-sessions";
import { listValidations } from "@/lib/api/validations";
import { notFound } from "next/navigation";
import type {
  Camera,
  ProcessorStatusRecord,
  StreamSession,
  StreamValidation,
} from "@/lib/api/types";

// Monitor tab — the operator-facing view. Live stream (with optional live
// perception overlay), latest frame + latest-frame perception overlay, session
// info, and the camera/agent/validation meta panels. The persistent header,
// status badge, and Realtime listener live one level up in layout.tsx.
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

  const [agent, sessions, latestFrame, latestPerception] = await Promise.all([
    // 404 = agent removed; other errors bubble to the segment error boundary.
    getAgent({ accountId: activeAccountId, agentId: camera.agent_id }).catch(
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
    // getLatestFrame already returns null on 404 / snapshot_not_found.
    getLatestFrame({ accountId: activeAccountId, cameraId: camera.id }),
    // getLatestPerception already returns null on 404 /
    // perception_snapshot_not_found.
    getLatestPerception({ accountId: activeAccountId, cameraId: camera.id }),
  ]);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <LiveStreamPanelNext
            session={currentSession}
            renderStreaming={(session) => (
              <LivePerceptionOverlayNext
                sessionId={session.id}
                cameraId={session.camera_id}
                approved={session.approved}
                initialPerception={latestPerception}
              />
            )}
          />
          {currentSession ? <SessionPanel session={currentSession} /> : null}
        </div>
        <div>
          <LatestFrameCardNext
            cameraId={camera.id}
            initialFrame={latestFrame}
          />
        </div>
      </div>

      <LatestFramePerceptionOverlayNext
        cameraId={camera.id}
        initialFrame={latestFrame}
        initialPerception={latestPerception}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        <CameraMetaPanel camera={camera} />
        <AgentPanel agent={agent} />
        <ValidationPanel validation={latestValidation} />
        <AppliedGeometryPanel status={processorStatus} />
      </div>
    </div>
  );
}
