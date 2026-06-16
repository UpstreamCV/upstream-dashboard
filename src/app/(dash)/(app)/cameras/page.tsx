import { CamerasGridClient } from "@/components/dashboard-next/cameras-grid-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { listAlerts } from "@/lib/api/alerts";
import { listCameras } from "@/lib/api/cameras";

// dashboard-next Cameras (DarkMode redesign, Figma frame 409:403). Parallel
// server fetch seeds a client wrapper that polls /v1/cameras + /v1/agents +
// open /v1/alerts. The fleet is grouped into the four Figma buckets
// (live | review | offline | idle) by deriveCameraBucket(status, hasOpenAlert).
// The card primary links to /cameras/{id}; "Add camera" →
// /cameras/new. Loading/error are covered by the segment
// loading.tsx/error.tsx.
export default async function CamerasPage() {
  const { activeAccountId } = await getActiveAccount();
  const [cameras, agents, openAlerts] = await Promise.all([
    listCameras({ accountId: activeAccountId }),
    listAgents({ accountId: activeAccountId }),
    // Open alerts seed the "needs review" bucket. Tolerant: a missing/erroring
    // alerts surface must never break the cameras page — fall back to none.
    listAlerts({ accountId: activeAccountId, status: "open", limit: 200 }).catch(
      () => [],
    ),
  ]);
  const total = cameras.length;

  return (
    <section className="space-y-5 md:space-y-6">
      <header>
        <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          fleet
        </p>
        <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
          Cameras <span className="text-white/55">· {total}</span>
        </h1>
      </header>

      <CamerasGridClient
        initialCameras={cameras}
        initialAgents={agents}
        initialAlerts={openAlerts}
      />
    </section>
  );
}
