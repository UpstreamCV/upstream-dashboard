"use client";

import { Column, DataTable } from "@/components/data/data-table";
import { StatusBadge } from "@/components/data/status-badge";
import { useUpstreamList } from "@/lib/api/use-list";
import type { Camera, CameraListResponse } from "@/lib/api/types";

function specSummary(c: Camera): string {
  const parts: string[] = [];
  if (c.default_width && c.default_height) {
    parts.push(`${c.default_width}×${c.default_height}`);
  }
  if (c.default_fps) parts.push(`${c.default_fps} fps`);
  if (c.default_codec) parts.push(c.default_codec);
  if (c.default_bitrate_kbps) parts.push(`${c.default_bitrate_kbps} kbps`);
  return parts.join(" · ") || "—";
}

export function CamerasTable({
  initialCameras,
  agentNames,
}: {
  initialCameras: Camera[];
  agentNames: Record<string, string>;
}) {
  const { data } = useUpstreamList<CameraListResponse>("/v1/cameras", {
    fallbackData: { cameras: initialCameras },
  });
  const cameras = data?.cameras ?? initialCameras;

  const columns: Column<Camera>[] = [
    {
      key: "name",
      header: "Name",
      cell: (c) => (
        <div className="flex flex-col">
          <span className="text-ink">{c.name}</span>
          {c.external_id ? (
            <span className="text-ink-mute mono text-[11px]">
              {c.external_id}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge status={c.status} />,
    },
    {
      key: "agent",
      header: "Agent",
      cell: (c) => (
        <span className="text-ink-soft">
          {c.agent_id === null ? (
            <span className="mono text-ink-mute">unassigned</span>
          ) : (
            agentNames[c.agent_id] ?? (
              <span className="mono text-ink-mute">{c.agent_id.slice(0, 8)}…</span>
            )
          )}
        </span>
      ),
    },
    {
      key: "spec",
      header: "Defaults",
      cell: (c) => (
        <span className="text-ink-soft mono text-[12px]">{specSummary(c)}</span>
      ),
    },
    {
      key: "latency",
      header: "Latency",
      cell: (c) => (
        <span className="text-ink-soft mono text-[12px] capitalize">
          {c.default_latency_mode}
        </span>
      ),
    },
  ];

  return (
    <DataTable<Camera>
      columns={columns}
      rows={cameras}
      rowKey={(c) => c.id}
      rowHref={(c) => `/dashboard-legacy/cameras/${c.id}`}
    />
  );
}
