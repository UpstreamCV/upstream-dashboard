"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import {
  deleteWorkflowAction,
  setWorkflowEnabledAction,
} from "@/app/dashboard/(app)/workflows/actions";
import { RelativeTime } from "@/components/data/relative-time";
import type { Workflow } from "@/lib/api/types";
import { sequenceSummaryLabel } from "@/lib/workflows/sequence-config-schema";

// Workflow Engine M5 — sequence workflow definitions list (the top-level
// product objects). Rendered above the run history on /dashboard/workflows.

const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs font-bold text-black/70 transition hover:border-[var(--dn-creek-mid)] hover:text-black disabled:cursor-not-allowed disabled:opacity-50";

const SEVERITY_CHIP: Record<string, string> = {
  info: "bg-black/[0.06] text-black/70",
  warning: "bg-[#8a6d1f]/15 text-[#8a6d1f]",
  critical: "bg-red-700/10 text-red-700",
};

interface WorkflowDefinitionsClientProps {
  workflows: Workflow[];
  cameraNames: Record<string, string>;
  canEdit: boolean;
}

export function WorkflowDefinitionsClient({
  workflows,
  cameraNames,
  canEdit,
}: WorkflowDefinitionsClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: typeof deleteWorkflowAction, workflow: Workflow, enabled?: boolean) {
    const formData = new FormData();
    formData.set("workflow_id", workflow.id);
    if (enabled !== undefined) formData.set("enabled", String(enabled));
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
          <GitBranch className="h-4 w-4" aria-hidden />
          sequence workflows
        </p>
        {canEdit ? (
          <Link
            href="/dashboard/workflows/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--dn-creek-mid)] px-3 py-1.5 text-sm font-bold text-white transition hover:bg-[var(--dn-creek-deep)]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New sequence workflow
          </Link>
        ) : null}
      </div>
      {workflows.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--dn-text-50)]">
          No sequence workflows yet. Sequences watch for event A, then expect
          event B within a time window — completed when B arrives, failed
          (with an optional alert) when it doesn&rsquo;t.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {workflows.map((workflow) => (
            <li
              key={workflow.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-black/[0.02] p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-black">{workflow.name}</span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
                      (SEVERITY_CHIP[workflow.severity] ?? SEVERITY_CHIP.info)
                    }
                  >
                    {workflow.severity}
                  </span>
                  {!workflow.enabled ? (
                    <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black/50">
                      disabled
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--dn-text-50)]">
                  {sequenceSummaryLabel(workflow)}
                </p>
                <p className="mt-0.5 text-xs font-mono text-[var(--dn-text-50)]">
                  {cameraNames[workflow.camera_id] ?? "Unknown camera"} · created{" "}
                  <RelativeTime value={workflow.created_at} />
                </p>
              </div>
              {canEdit ? (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      run(setWorkflowEnabledAction, workflow, !workflow.enabled)
                    }
                    className={GHOST_BTN}
                    disabled={pending}
                  >
                    {workflow.enabled ? "Disable" : "Enable"}
                  </button>
                  <button
                    type="button"
                    onClick={() => run(deleteWorkflowAction, workflow)}
                    className={GHOST_BTN + " hover:border-red-700/40 hover:text-red-700"}
                    disabled={pending}
                    aria-label={`Delete workflow ${workflow.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
