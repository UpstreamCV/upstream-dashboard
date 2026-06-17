import { Search } from "lucide-react";
import { SessionsTableClient } from "@/components/dashboard-next/sessions-table-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { listCameras } from "@/lib/api/cameras";
import { listStreamSessions } from "@/lib/api/stream-sessions";

// dashboard-next Stream Sessions. Mirrors the live
// src/app/(dash)/stream-sessions/page.tsx: parallel server fetch of
// sessions + cameras + agents, then hand session IDs and name lookup tables
// to a client wrapper that polls /v1/stream-sessions?limit=100 every 10s.
export default async function StreamSessionsPage() {
  const { activeAccountId } = await getActiveAccount();
  const [sessions, cameras, agents] = await Promise.all([
    listStreamSessions({ accountId: activeAccountId, limit: 100 }),
    listCameras({ accountId: activeAccountId }),
    listAgents({ accountId: activeAccountId }),
  ]);
  const total = sessions.length;
  const cameraNames: Record<string, string> = Object.fromEntries(
    cameras.map((c) => [c.id, c.name]),
  );
  const agentNames: Record<string, string> = Object.fromEntries(
    agents.map((a) => [a.id, a.name]),
  );

  return (
    <section className="space-y-5 md:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
            ingest
          </p>
          <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
            Stream Sessions <span className="text-white/55">· {total}</span>
          </h1>
        </div>
        {/* Presentational — filtering isn't wired. WIRE-UP: lift to a client
            component with query state to filter by camera/agent/state/id. */}
        <div className="dn-glow-soft relative rounded-full sm:w-[clamp(190px,22vw,300px)]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-white/75"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search sessions"
            placeholder="Search sessions…"
            className="dn-field relative z-[1] w-full py-2 pl-9 pr-4 text-[clamp(0.85rem,1vw,1rem)]"
          />
        </div>
      </header>

      <SessionsTableClient
        initialSessions={sessions}
        cameraNames={cameraNames}
        agentNames={agentNames}
      />
    </section>
  );
}
