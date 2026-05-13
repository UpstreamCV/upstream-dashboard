"use client";

import { Column, DataTable } from "@/components/data/data-table";
import { RelativeTime } from "@/components/data/relative-time";
import { StatusBadge } from "@/components/data/status-badge";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  StreamSession,
  StreamSessionListResponse,
} from "@/lib/api/types";

function approvedSummary(s: StreamSession): string {
  return `${s.approved.width}×${s.approved.height} · ${s.approved.fps} fps · ${s.approved.codec} · ${s.approved.bitrate_kbps} kbps`;
}

export function SessionsTable({
  initialSessions,
  cameraNames,
  agentNames,
}: {
  initialSessions: StreamSession[];
  cameraNames: Record<string, string>;
  agentNames: Record<string, string>;
}) {
  const { data } = useUpstreamList<StreamSessionListResponse>(
    "/v1/stream-sessions?limit=100",
    { fallbackData: { sessions: initialSessions } },
  );
  const sessions = data?.sessions ?? initialSessions;

  const columns: Column<StreamSession>[] = [
    {
      key: "id",
      header: "ID",
      cell: (s) => (
        <span className="mono text-[11px] text-ink-soft">
          {s.id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "state",
      header: "State",
      cell: (s) => <StatusBadge status={s.state} />,
    },
    {
      key: "camera",
      header: "Camera",
      cell: (s) => (
        <span className="text-ink-soft">
          {cameraNames[s.camera_id] ?? (
            <span className="mono text-ink-mute">
              {s.camera_id.slice(0, 8)}…
            </span>
          )}
        </span>
      ),
    },
    {
      key: "agent",
      header: "Agent",
      cell: (s) => (
        <span className="text-ink-soft">
          {agentNames[s.agent_id] ?? (
            <span className="mono text-ink-mute">
              {s.agent_id.slice(0, 8)}…
            </span>
          )}
        </span>
      ),
    },
    {
      key: "approved",
      header: "Approved",
      cell: (s) => (
        <span className="mono text-[12px] text-ink-soft">
          {approvedSummary(s)}
        </span>
      ),
    },
    {
      key: "started",
      header: "Started",
      cell: (s) => (
        <RelativeTime value={s.started_at} className="text-ink-soft" />
      ),
    },
    {
      key: "ended",
      header: "Ended",
      cell: (s) => (
        <RelativeTime value={s.ended_at} className="text-ink-soft" />
      ),
    },
  ];

  return (
    <DataTable<StreamSession>
      columns={columns}
      rows={sessions}
      rowKey={(s) => s.id}
    />
  );
}
