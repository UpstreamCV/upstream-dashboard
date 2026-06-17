import { AppliedGeometryPanel } from "@/components/dashboard-next/applied-geometry-panel";
import {
  AgentPanel,
  CameraMetaPanel,
  SessionPanel,
  ValidationPanel,
} from "@/components/dashboard-next/camera-panels";
import { ReliabilityPanel } from "@/components/dashboard-next/reliability-panel";
import { getActiveAccount } from "@/lib/account/active";
import { getAgent } from "@/lib/api/agents";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import { getLatestProcessorStatus } from "@/lib/api/processor-status";
import { getReliabilitySummary } from "@/lib/api/reliability";
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

// Camera Command Center — the camera's default landing tab: a status-first
// overview (reliability verdict, current session, applied geometry, agent +
// camera meta, latest validation) WITHOUT opening the live WHEP stream — that's
// the Live Monitor tab's job. Composes the same panels the Monitor rail uses
// (camera-panels.tsx + ReliabilityPanel + AppliedGeometryPanel), so it adds no
// new components or fetches beyond what already exists.
//
// Fetch shape mirrors the Monitor tab (minus the perception/stream bits): camera
// (the 404 gate) → agent + latest session + reliability in parallel → then the
// session-dependent validations + processor status.
export default async function CameraOverviewPage({
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

  const [agent, sessions, reliabilitySummary] = await Promise.all([
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
    getReliabilitySummary({ accountId: activeAccountId, cameraId: camera.id }),
  ]);
  const reliability: ReliabilitySummary | null = reliabilitySummary;
  const currentSession: StreamSession | null = sessions[0] ?? null;

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
    getLatestProcessorStatus({
      accountId: activeAccountId,
      cameraId: camera.id,
      streamSessionId: currentSession?.id,
    }),
  ]);
  const latestValidation = validations[0] ?? null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Verdict + current session lead the overview. */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <ReliabilityPanel summary={reliability} cameraId={camera.id} />
          {currentSession ? <SessionPanel session={currentSession} /> : null}
        </div>
        {/* Runtime context beside it. */}
        <div className="space-y-4 md:space-y-6">
          <AppliedGeometryPanel status={processorStatus} />
          <AgentPanel agent={agent} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <CameraMetaPanel camera={camera} />
        <ValidationPanel validation={latestValidation} />
      </div>
    </div>
  );
}
