import { CollectorDashboardClient } from "@/components/dashboard-next/collector-dashboard-client";
import { CollectorIssuesClient } from "@/components/dashboard-next/collector-issues-client";
import { CollectorSetupCard } from "@/components/dashboard-next/collector-setup-card";
import { getActiveAccount } from "@/lib/account/active";
import {
  getCollectorStatus,
  getReliabilitySources,
  listReliabilityIssues,
} from "@/lib/api/reliability-collector";
import type { CollectorStatus } from "@/lib/api/types";

// Upstream Collector command center (M1c). A compartmentalized view under the
// Agents area for the collector workflow — separate from the managed camera
// pipeline. Shows CLOUD-visible ingest status (from DB rows; the browser can't
// reach the collector's localhost /status), the sources sending observations,
// recent ingest activity, observation issues, and setup instructions.

const EMPTY_STATUS: CollectorStatus = {
  last_received_at: null,
  recent_batch_count: 0,
  recent_observation_count: 0,
  active_source_count: 0,
  open_issue_count: 0,
  latest_collector_heartbeat: null,
  sources: [],
  recent_batches: [],
  source_health_counts: {
    healthy: 0,
    delayed: 0,
    silent: 0,
    collector_offline: 0,
    unknown: 0,
    disabled: 0,
  },
};

export default async function CollectorPage() {
  const { activeAccountId, activeAccount } = await getActiveAccount();
  const canResolve =
    activeAccount.role === "owner" || activeAccount.role === "admin";

  const [status, sources, issues] = await Promise.all([
    getCollectorStatus({ accountId: activeAccountId }),
    getReliabilitySources({ accountId: activeAccountId }),
    listReliabilityIssues({ accountId: activeAccountId, status: "open" }),
  ]);

  return (
    <section className="space-y-5 md:space-y-6">
      <header>
        <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          fleet
        </p>
        <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
          Upstream Collector
        </h1>
        <p className="mt-1 max-w-prose text-sm text-white/70">
          Cloud-visible status for observations your collector or external CV
          system uploads. Sources here are external collector sources — not
          necessarily managed Upstream cameras. Spool/upload detail that only the
          collector machine knows lives at its own{" "}
          <span className="font-mono">/status</span>.
        </p>
      </header>

      <CollectorDashboardClient
        initialStatus={status ?? EMPTY_STATUS}
        initialSources={sources}
        canConfigure={canResolve}
      />
      <CollectorIssuesClient initialIssues={issues} canResolve={canResolve} />
      <CollectorSetupCard />
    </section>
  );
}
