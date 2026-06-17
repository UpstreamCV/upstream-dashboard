"use client";

import { useState } from "react";
import clsx from "clsx";
import { SessionsTable } from "./sessions-table";
import { StatCard } from "./stat-card";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  StreamSession,
  StreamSessionListResponse,
  StreamSessionState,
} from "@/lib/api/types";

// Polls /v1/stream-sessions?limit=100 every 10s. Camera/agent name lookups
// come from the server fetch on first paint and remain stable for the page
// lifetime — sessions reference IDs we may not have current names for, but
// the camera and agent rosters change far more slowly than session state, so
// re-fetching their names every tick would be wasteful.
//
// The Active / History filter is a client-side facet over the polled list
// (the proposed "Active Sessions" and "Session History" are views, not routes):
// Active = streaming|approved (live or queued), History = ended|expired|failed.

type SessionFilter = "all" | "active" | "history";

const FILTERS: { key: SessionFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "history", label: "History" },
];

const ACTIVE_STATES = new Set<StreamSessionState>(["streaming", "approved"]);
const HISTORY_STATES = new Set<StreamSessionState>([
  "ended",
  "expired",
  "failed",
]);

function matchesFilter(s: StreamSession, filter: SessionFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return ACTIVE_STATES.has(s.state);
  return HISTORY_STATES.has(s.state);
}

export function SessionsTableClient({
  initialSessions,
  cameraNames,
  agentNames,
}: {
  initialSessions: StreamSession[];
  cameraNames: Record<string, string>;
  agentNames: Record<string, string>;
}) {
  const [filter, setFilter] = useState<SessionFilter>("all");

  const sessions =
    useUpstreamList<StreamSessionListResponse>(
      "/v1/stream-sessions?limit=100",
      { fallbackData: { sessions: initialSessions } },
    ).data?.sessions ?? initialSessions;

  const total = sessions.length;
  const streaming = sessions.filter((s) => s.state === "streaming").length;
  const approved = sessions.filter((s) => s.state === "approved").length;
  const failed = sessions.filter((s) => s.state === "failed").length;

  const visible = sessions.filter((s) => matchesFilter(s, filter));

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
        <>
          <div
            role="tablist"
            aria-label="Session filter"
            className="flex flex-wrap items-center gap-1"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-[clamp(0.78rem,1vw,0.92rem)] transition",
                  filter === f.key
                    ? "bg-white text-black font-bold dn-glow-soft"
                    : "text-white hover:bg-white/10",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {visible.length > 0 ? (
            <SessionsTable
              sessions={visible}
              cameraNames={cameraNames}
              agentNames={agentNames}
            />
          ) : (
            <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
              <p className="text-[var(--dn-text-50)] text-[clamp(0.85rem,1vw,1rem)]">
                No {filter} sessions.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
