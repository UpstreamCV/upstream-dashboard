import { Search } from "lucide-react";
import { AgentsGridClient } from "@/components/dashboard-next/agents-grid-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";

// dashboard-next Agents. Mirrors the live src/app/dashboard/agents/page.tsx:
// server-fetch listAgents, hand to a polling client wrapper. Counts are
// derived inside the wrapper via agentState() so the 90s heartbeat window
// is the single source of truth.
//
// No agent detail page exists in prod — the AgentCard "View" pill is inert
// for now. Loading/error covered by the segment files.
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

      <AgentsGridClient initialAgents={agents} />
    </section>
  );
}
