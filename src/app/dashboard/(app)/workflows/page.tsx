import { WorkflowRunsClient } from "@/components/dashboard-next/workflows/workflow-runs-client";
import { getActiveAccount } from "@/lib/account/active";
import { listCameras } from "@/lib/api/cameras";
import { listWorkflowRuns } from "@/lib/api/workflow-runs";

// Workflow Engine M2 — the account-wide workflow history. Every rule match
// is recorded here as a workflow run, INCLUDING cooldown-suppressed matches
// that sent no alert — this page is the system of record for camera
// workflows; the alert inbox is just one action's output.
//
// Server-renders the initial list; <WorkflowRunsClient> polls
// /v1/workflow-runs via the proxy every 10s and switches the server-side
// status filter per tab.

export default async function WorkflowsPage() {
  const { activeAccountId } = await getActiveAccount();

  const [runs, cameras] = await Promise.all([
    listWorkflowRuns({ accountId: activeAccountId, limit: 100 }),
    listCameras({ accountId: activeAccountId }),
  ]);

  const cameraNames: Record<string, string> = {};
  for (const camera of cameras) {
    cameraNames[camera.id] = camera.name;
  }

  return (
    <section className="space-y-5 md:space-y-6">
      <header>
        <p className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          automation
        </p>
        <h1 className="font-bold text-white text-[clamp(1.6rem,3.2vw,2.4rem)]">
          Workflows
        </h1>
        <p className="mt-1 text-sm text-white/70">
          Every workflow execution on your cameras — what fired, on which
          camera, what evidence triggered it, and what action followed.
          Suppressed runs are recorded too, even when no alert was sent.
        </p>
      </header>

      <WorkflowRunsClient initialRuns={runs} cameraNames={cameraNames} />
    </section>
  );
}
