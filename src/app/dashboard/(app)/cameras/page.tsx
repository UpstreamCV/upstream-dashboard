import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { CamerasGridClient } from "@/components/dashboard-next/cameras-grid-client";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { listCameras } from "@/lib/api/cameras";

// dashboard-next Cameras. Mirrors the live src/app/dashboard/cameras/page.tsx
// flow: parallel server fetch, hand initial data to a client wrapper that
// polls /v1/cameras + /v1/agents every 10s. The CameraCard "View" pill links
// to /dashboard-next/cameras/{id} (detail page lives at
// (app)/cameras/[cameraId]).
//
// Loading/error are covered by the segment loading.tsx/error.tsx.
export default async function CamerasPage() {
  const { activeAccountId } = await getActiveAccount();
  const [cameras, agents] = await Promise.all([
    listCameras({ accountId: activeAccountId }),
    listAgents({ accountId: activeAccountId }),
  ]);
  const total = cameras.length;

  return (
    <section className="space-y-5 md:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
            fleet
          </p>
          <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
            Cameras <span className="text-white/55">· {total}</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
        <Link
          href="/dashboard/cameras/new"
          className="dn-btn dn-glow-soft inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New camera
        </Link>
        {/* Presentational — filtering isn't wired. WIRE-UP: lift the grid to a
            stateful client component with query state to filter by
            name/external_id/agent. */}
        <div className="dn-glow-soft relative rounded-full sm:w-[clamp(190px,22vw,300px)]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 h-4 w-4 text-white/75"
            aria-hidden
          />
          <input
            type="search"
            aria-label="Search cameras"
            placeholder="Search cameras…"
            className="dn-field relative z-[1] w-full py-2 pl-9 pr-4 text-[clamp(0.85rem,1vw,1rem)]"
          />
        </div>
        </div>
      </header>

      <CamerasGridClient initialCameras={cameras} initialAgents={agents} />
    </section>
  );
}
