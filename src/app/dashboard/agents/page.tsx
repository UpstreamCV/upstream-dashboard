import { Cpu } from "lucide-react";
import { EmptyState } from "@/components/data/empty-state";
import { PageHeader } from "@/components/data/page-header";
import { getActiveAccount } from "@/lib/account/active";
import { listAgents } from "@/lib/api/agents";
import { AgentsTable } from "./agents-table";

export default async function AgentsPage() {
  const { activeAccountId } = await getActiveAccount();
  const agents = await listAgents({ accountId: activeAccountId });

  return (
    <section>
      <PageHeader
        eyebrow="fleet"
        title="Connected"
        accent="agents"
        description="Devices running the upstream-agent package. Status updates every 10 seconds."
      />
      {agents.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No agents connected yet"
          description={
            <>
              Generate an API token from{" "}
              <span className="mono text-ink">Settings → API tokens</span>, then
              install <span className="mono text-ink">upstream-agent</span> on a
              device. It will appear here automatically.
            </>
          }
        />
      ) : (
        <AgentsTable initialAgents={agents} />
      )}
    </section>
  );
}
