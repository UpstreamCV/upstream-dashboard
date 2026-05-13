import { Video } from "lucide-react";
import { EmptyState } from "@/components/data/empty-state";
import { PageHeader } from "@/components/data/page-header";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { listCameras } from "@/lib/api/cameras";
import { CamerasTable } from "./cameras-table";

export default async function CamerasPage() {
  const { activeAccountId } = await getActiveAccount();
  const [cameras, agents] = await Promise.all([
    listCameras({ accountId: activeAccountId }),
    listAgents({ accountId: activeAccountId }),
  ]);

  const agentsById = Object.fromEntries(agents.map((a) => [a.id, a]));

  return (
    <section>
      <PageHeader
        eyebrow="fleet"
        title="Registered"
        accent="cameras"
        description="All cameras declared by your connected agents. Click any row for live state, latest frame, and stream history."
      />
      {cameras.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No cameras yet"
          description={
            <>
              Once an agent registers a camera through{" "}
              <span className="mono text-ink">upstream-agent start</span>, it
              appears here. Start with{" "}
              <span className="mono text-ink">Settings → API tokens</span> to
              issue the agent its credentials.
            </>
          }
        />
      ) : (
        <CamerasTable
          initialCameras={cameras}
          agentNames={Object.fromEntries(
            Object.entries(agentsById).map(([id, a]) => [id, a.name]),
          )}
        />
      )}
    </section>
  );
}
