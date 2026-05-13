"use client";

import { Column, DataTable } from "@/components/data/data-table";
import { RelativeTime } from "@/components/data/relative-time";
import { StatusBadge } from "@/components/data/status-badge";
import { useUpstreamList } from "@/lib/api/use-list";
import type { Agent, AgentListResponse } from "@/lib/api/types";

const columns: Column<Agent>[] = [
  {
    key: "name",
    header: "Name",
    cell: (a) => (
      <div className="flex flex-col">
        <span className="text-ink">{a.name}</span>
        {a.hostname ? (
          <span className="text-ink-mute mono text-[11px]">{a.hostname}</span>
        ) : null}
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (a) => <StatusBadge status={a.status} />,
  },
  {
    key: "version",
    header: "Version",
    cell: (a) => (
      <span className="mono text-ink-soft">{a.version ?? "—"}</span>
    ),
  },
  {
    key: "os",
    header: "OS",
    cell: (a) => (
      <span className="text-ink-soft">
        {a.os ?? "—"}
        {a.python_version ? (
          <span className="mono text-ink-mute text-[11px] ml-1.5">
            py{a.python_version}
          </span>
        ) : null}
      </span>
    ),
  },
  {
    key: "last_seen",
    header: "Last seen",
    cell: (a) => (
      <RelativeTime value={a.last_seen_at} className="text-ink-soft" />
    ),
  },
];

export function AgentsTable({ initialAgents }: { initialAgents: Agent[] }) {
  const { data } = useUpstreamList<AgentListResponse>("/v1/agents", {
    fallbackData: { agents: initialAgents },
  });
  const agents = data?.agents ?? initialAgents;

  return (
    <DataTable<Agent>
      columns={columns}
      rows={agents}
      rowKey={(a) => a.id}
    />
  );
}
