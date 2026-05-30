import { Activity } from "lucide-react";
import { EmptyState } from "@/components/data/empty-state";
import { PageHeader } from "@/components/data/page-header";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { listCameras } from "@/lib/api/cameras";
import { listStreamSessions } from "@/lib/api/stream-sessions";
import { SessionsTable } from "./sessions-table";

export default async function StreamSessionsPage() {
  const { activeAccountId } = await getActiveAccount();
  const [sessions, cameras, agents] = await Promise.all([
    listStreamSessions({ accountId: activeAccountId, limit: 100 }),
    listCameras({ accountId: activeAccountId }),
    listAgents({ accountId: activeAccountId }),
  ]);

  return (
    <section>
      <PageHeader
        eyebrow="ingest"
        title="Stream"
        accent="sessions"
        description="Each session is an SRT publish window. Most recent first; refreshes every 10 seconds."
      />
      {sessions.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No sessions yet"
          description={
            <>
              Sessions appear when an agent calls{" "}
              <span className="mono text-ink">POST /v1/stream-sessions/start</span>.
              Try{" "}
              <span className="mono text-ink">
                upstream-agent start --camera-id …
              </span>{" "}
              from any device with a registered camera.
            </>
          }
        />
      ) : (
        <SessionsTable
          initialSessions={sessions}
          cameraNames={Object.fromEntries(cameras.map((c) => [c.id, c.name]))}
          agentNames={Object.fromEntries(agents.map((a) => [a.id, a.name]))}
        />
      )}
    </section>
  );
}
