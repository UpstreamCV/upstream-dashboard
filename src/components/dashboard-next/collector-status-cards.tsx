import type { ReactNode } from "react";
import { RelativeTime } from "@/components/data/relative-time";
import type { CollectorStatus } from "@/lib/api/types";
import { StatusDot, type DotStatus } from "./status-dot";

// Top-of-page status overview for /agents/collector. All counts/timestamps are
// CLOUD-visible (derived from DB rows over the last 24h) — the browser can't
// reach the collector's localhost /status. The heartbeat card reflects the
// latest cloud-visible collector_heartbeat; "not reported yet" cleanly
// distinguishes cloud-ingest status from local-only collector status.

// A heartbeat older than this reads as stale (the agent sends ~every 60s).
const HEARTBEAT_FRESH_WINDOW_MS = 150_000;

// Mirrors agent-card's agentState(): the freshness read lives in a named helper
// (not inline in render) — the single source of truth for the heartbeat dot.
function isHeartbeatFresh(observedAt: string): boolean {
  return Date.now() - Date.parse(observedAt) < HEARTBEAT_FRESH_WINDOW_MS;
}

function Tile({
  label,
  status,
  children,
}: {
  label: string;
  status?: DotStatus;
  children: ReactNode;
}) {
  return (
    <div className="dn-tile flex flex-col gap-2 p-[clamp(0.9rem,1.6vw,1.4rem)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          {label}
        </span>
        {status && <StatusDot status={status} />}
      </div>
      <span className="font-bold leading-none text-[clamp(1.2rem,2.4vw,1.9rem)]">
        {children}
      </span>
    </div>
  );
}

export function CollectorStatusCards({ status }: { status: CollectorStatus }) {
  const hb = status.latest_collector_heartbeat;
  const hbFresh = hb != null && isHeartbeatFresh(hb.observed_at);

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
      <Tile label="Last cloud ingest" status={status.last_received_at ? "green" : "neutral"}>
        {status.last_received_at ? (
          <RelativeTime value={status.last_received_at} />
        ) : (
          "—"
        )}
      </Tile>
      <Tile label="Recent observations">
        {status.recent_observation_count.toLocaleString()}
      </Tile>
      <Tile label="Sources active">{status.active_source_count}</Tile>
      <Tile
        label="Open issues"
        status={status.open_issue_count > 0 ? "orange" : "green"}
      >
        {status.open_issue_count}
      </Tile>
      <Tile
        label="Collector heartbeat"
        status={hb ? (hbFresh ? "green" : "orange") : "neutral"}
      >
        {hb ? (
          <RelativeTime value={hb.observed_at} />
        ) : (
          <span className="text-[clamp(0.85rem,1vw,1rem)] font-bold text-[var(--dn-text-50)]">
            not reported yet
          </span>
        )}
      </Tile>
    </div>
  );
}
