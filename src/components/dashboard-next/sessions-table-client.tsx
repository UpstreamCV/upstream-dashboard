"use client";

import { SessionsTable } from "./sessions-table";
import { StatCard } from "./stat-card";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  StreamSession,
  StreamSessionListResponse,
} from "@/lib/api/types";

// Polls /v1/stream-sessions?limit=100 every 10s. Camera/agent name lookups
// come from the server fetch on first paint and remain stable for the page
// lifetime — sessions reference IDs we may not have current names for, but
// the camera and agent rosters change far more slowly than session state, so
// re-fetching their names every tick would be wasteful.

export function SessionsTableClient({
  initialSessions,
  cameraNames,
  agentNames,
}: {
  initialSessions: StreamSession[];
  cameraNames: Record<string, string>;
  agentNames: Record<string, string>;
}) {
  const sessions =
    useUpstreamList<StreamSessionListResponse>(
      "/v1/stream-sessions?limit=100",
      { fallbackData: { sessions: initialSessions } },
    ).data?.sessions ?? initialSessions;

  const total = sessions.length;
  const streaming = sessions.filter((s) => s.state === "streaming").length;
  const approved = sessions.filter((s) => s.state === "approved").length;
  const failed = sessions.filter((s) => s.state === "failed").length;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Total" value={total} />
        <StatCard label="Streaming" value={streaming} status="green" />
        <StatCard label="Approved" value={approved} status="yellow" />
        <StatCard
          label="Failed"
          value={failed}
          status={failed > 0 ? "red" : "neutral"}
        />
      </div>

      {sessions.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <p className="font-bold text-[clamp(1rem,1.4vw,1.3rem)]">
            No stream sessions yet
          </p>
          <p className="mt-2 text-[var(--dn-text-50)] text-[clamp(0.85rem,1vw,1rem)]">
            Sessions appear here once an agent publishes a stream.
          </p>
        </div>
      ) : (
        <SessionsTable
          sessions={sessions}
          cameraNames={cameraNames}
          agentNames={agentNames}
        />
      )}
    </>
  );
}
