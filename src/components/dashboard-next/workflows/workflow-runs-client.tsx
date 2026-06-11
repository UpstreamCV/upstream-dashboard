"use client";

import { useState } from "react";
import Link from "next/link";
import { ListChecks } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import type { WorkflowRun, WorkflowRunListResponse } from "@/lib/api/types";
import { useUpstreamList } from "@/lib/api/use-list";
import {
  workflowRunActionResultLabel,
  workflowRunStatusChipClass,
  workflowRunStatusLabel,
  workflowRunTriggerLabel,
} from "@/lib/workflows/workflow-run-format";

// Workflow Engine M2 — workflow run history list. Polls /v1/workflow-runs
// through the proxy at the standard 10s cadence; tabs switch the
// server-side status filter. Each row expands (plain <details>, mirroring
// the observations panel) to show the evidence payload and run ids — the
// "system of record" view without a separate detail route.

const TAB_BTN =
  "rounded-full px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed";

type Tab = "all" | "completed" | "suppressed";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "suppressed", label: "Suppressed" },
];

interface WorkflowRunsClientProps {
  initialRuns: WorkflowRun[];
  cameraNames: Record<string, string>;
}

export function WorkflowRunsClient({
  initialRuns,
  cameraNames,
}: WorkflowRunsClientProps) {
  const [tab, setTab] = useState<Tab>("all");

  const path =
    tab === "all"
      ? "/v1/workflow-runs?limit=100"
      : `/v1/workflow-runs?status=${tab}&limit=100`;
  const { data } = useUpstreamList<WorkflowRunListResponse>(
    path,
    tab === "all" ? { fallbackData: { runs: initialRuns } } : undefined,
  );
  const runs = data?.runs ?? [];

  return (
    <div className="space-y-4">
      <div className="dn-tile inline-flex items-center gap-1 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={
              TAB_BTN +
              (tab === t.key
                ? " bg-[var(--dn-creek-mid)] text-white"
                : " text-black/60 hover:text-black")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {runs.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <ListChecks
            className="mx-auto h-8 w-8 text-[var(--dn-text-50)]"
            aria-hidden
          />
          <h3 className="mt-4 font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-black">
            No workflow runs yet
          </h3>
          <p className="mx-auto mt-3 max-w-prose text-sm text-[var(--dn-text-50)]">
            When a camera rule matches a detection, the execution is recorded
            here — whether or not an alert was sent. Create rules per camera
            under Configure → Triggers &amp; Effects.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => (
            <li key={run.id} className="dn-tile p-[clamp(0.9rem,1.4vw,1.2rem)]">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-black">{run.title}</span>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
                        workflowRunStatusChipClass(run.status)
                      }
                    >
                      {workflowRunStatusLabel(run.status)}
                    </span>
                    <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-black/50">
                      {workflowRunTriggerLabel(run.trigger_type)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[var(--dn-text-50)]">
                    {run.summary} · {workflowRunActionResultLabel(run.action_result)}
                  </p>
                  <p className="mt-0.5 text-xs font-mono text-[var(--dn-text-50)]">
                    {run.camera_id ? (
                      <Link
                        href={`/dashboard/cameras/${run.camera_id}/monitor`}
                        className="underline hover:text-black"
                      >
                        {cameraNames[run.camera_id] ?? "Unknown camera"}
                      </Link>
                    ) : (
                      "account-wide"
                    )}
                    {" · "}
                    <RelativeTime value={run.started_at} />
                    {run.alert ? (
                      <>
                        {" · "}
                        <Link
                          href="/dashboard/alerts"
                          className="underline hover:text-black"
                        >
                          alert ({run.alert.severity}, {run.alert.status})
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)] hover:text-black">
                  Evidence &amp; run detail
                </summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/[0.04] p-3 font-mono text-[11px] text-black/80">
                  {JSON.stringify(
                    {
                      id: run.id,
                      workflow_type: run.workflow_type,
                      rule_id: run.rule_id,
                      workflow_id: run.workflow_id,
                      deadline_at: run.deadline_at,
                      trigger_observation_id: run.trigger_observation_id,
                      action_result: run.action_result,
                      evidence: run.evidence,
                      payload: run.payload,
                      started_at: run.started_at,
                      ended_at: run.ended_at,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
