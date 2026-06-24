"use client";

import type {
  CollectorStatus,
  ReliabilitySource,
  ReliabilitySourcesResponse,
} from "@/lib/api/types";
import { useUpstreamList } from "@/lib/api/use-list";
import { CollectorActivityTable } from "./collector-activity-table";
import { CollectorHealthSummary } from "./collector-health-summary";
import { CollectorSourcesTable } from "./collector-sources-table";
import { CollectorStatusCards } from "./collector-status-cards";

// Live cloud-ingest status for /agents/collector. Polls two summaries through
// the proxy at the standard 10s cadence, seeded by server-fetched snapshots:
// the collector-status summary (cards + recent ingest activity) and the M2a
// source registry (the stable Sources table). Shows a useful empty state until
// the first observation arrives.

export function CollectorDashboardClient({
  initialStatus,
  initialSources,
}: {
  initialStatus: CollectorStatus;
  initialSources: ReliabilitySource[];
}) {
  const { data: statusData } = useUpstreamList<CollectorStatus>(
    "/v1/reliability/collector-status",
    { fallbackData: initialStatus },
  );
  const status = statusData ?? initialStatus;

  const { data: sourcesData } = useUpstreamList<ReliabilitySourcesResponse>(
    "/v1/reliability/sources",
    { fallbackData: { sources: initialSources } },
  );
  const sources = sourcesData?.sources ?? initialSources;

  const isEmpty =
    !status.last_received_at &&
    sources.length === 0 &&
    status.recent_batches.length === 0 &&
    status.latest_collector_heartbeat == null;

  if (isEmpty) {
    return (
      <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
        <h3 className="font-bold text-[clamp(1rem,1.4vw,1.3rem)] text-white">
          No observations received yet
        </h3>
        <p className="mx-auto mt-2 max-w-prose text-sm text-[var(--dn-text-50)]">
          Start the collector and send your first observation to localhost. Use
          the setup steps below to get going.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:space-y-6">
      <CollectorStatusCards status={status} />
      <CollectorHealthSummary status={status} />
      <CollectorSourcesTable sources={sources} />
      <CollectorActivityTable batches={status.recent_batches} />
    </div>
  );
}
