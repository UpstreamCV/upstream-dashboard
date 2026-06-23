import Link from "next/link";
import { Radio, Search } from "lucide-react";
import { AgentsGridClient } from "@/components/dashboard-next/agents-grid-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";

// dashboard-next Agents. Mirrors the live src/app/(dash)/agents/page.tsx:
// server-fetch listAgents, hand to a polling client wrapper. Counts are
// derived inside the wrapper via agentState() so the 90s heartbeat window
// is the single source of truth.
//
// Each card links to the Agent Detail page (/agents/[agentId]) for heartbeat
// history + claimed cameras. Loading/error covered by the segment files.
export default async function AgentsPage() {
  const { activeAccountId } = await getActiveAccount();
  const agents = await listAgents({ accountId: activeAccountId });
  const total = agents.length;

  return (
    <section className="space-y-5 md:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
            fleet
          </p>
          <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
            Agents <span className="text-white/55">· {total}</span>
          </h1>
        </div>
        {/* Presentational — filtering isn't wired. WIRE-UP: lift to a client
            component with query state to filter by name/hostname/version. */}
        <div className="dn-glow-soft relative rounded-full sm:w-[clamp(190px,22vw,300px)]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-white/75"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search agents"
            placeholder="Search agents…"
            className="dn-field relative z-[1] w-full py-2 pl-9 pr-4 text-[clamp(0.85rem,1vw,1rem)]"
          />
        </div>
      </header>

      <Link
        href="/agents/collector"
        className="dn-tile flex items-center gap-3 p-[clamp(0.9rem,1.4vw,1.2rem)] transition-transform hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none"
      >
        <Radio className="h-5 w-5 shrink-0 text-[var(--dn-text-50)]" aria-hidden />
        <div className="min-w-0">
          <p className="font-bold text-white">Upstream Collector</p>
          <p className="text-sm text-[var(--dn-text-50)]">
            Send observations from your existing CV system to Upstream — status,
            sources, activity, and issues.
          </p>
        </div>
      </Link>

      <AgentsGridClient initialAgents={agents} />
    </section>
  );
}
