"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BellOff, CheckCheck } from "lucide-react";
import { resolveReliabilityIssueAction } from "@/app/(dash)/(app)/(fleet)/agents/collector/actions";
import { RelativeTime } from "@/components/data/relative-time";
import type { ReliabilityIssue, ReliabilityIssueListResponse } from "@/lib/api/types";
import { useUpstreamList } from "@/lib/api/use-list";

// Observation Issues — reliability issues the cloud detectors opened from
// collector observations (NOT managed-camera pipeline issues). Open/resolved
// tabs poll /v1/reliability/issues through the proxy; resolve goes through a
// Server Action then mutate(). Mirrors the alerts inbox.

const TAB_BTN =
  "rounded-full px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed";
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/80 transition hover:border-[var(--dn-creek-mid)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

const SEVERITY_CHIP: Record<string, string> = {
  info: "bg-white/[0.05] text-white/80",
  warning: "bg-[#8a6d1f]/15 text-[#8a6d1f]",
  critical: "bg-red-700/10 text-red-700",
};

// Defense-in-depth: never surface secret-ish or identifier-ish evidence keys.
const HIDDEN_EVIDENCE_KEY = /(token|secret|password|authorization|api[_-]?key|url|_id$)/i;

type Tab = "open" | "resolved";

function EvidenceList({ evidence }: { evidence: Record<string, unknown> }) {
  const rows = Object.entries(evidence).filter(
    ([k, v]) =>
      !HIDDEN_EVIDENCE_KEY.test(k) &&
      (typeof v === "string" || typeof v === "number" || typeof v === "boolean"),
  );
  if (rows.length === 0) return null;
  return (
    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dn-text-50)]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-1.5">
          <dt>{k.replace(/_/g, " ")}:</dt>
          <dd className="font-mono text-white/70">{String(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CollectorIssuesClient({
  initialIssues,
  canResolve,
}: {
  initialIssues: ReliabilityIssue[];
  canResolve: boolean;
}) {
  const [tab, setTab] = useState<Tab>("open");
  const [pending, startTransition] = useTransition();

  const { data, mutate } = useUpstreamList<ReliabilityIssueListResponse>(
    `/v1/reliability/issues?status=${tab}&limit=100`,
    tab === "open"
      ? { fallbackData: { issues: initialIssues.filter((i) => i.status === "open") } }
      : undefined,
  );
  const issues = data?.issues ?? [];

  function resolve(issue: ReliabilityIssue) {
    const formData = new FormData();
    formData.set("issue_id", issue.id);
    startTransition(async () => {
      const result = await resolveReliabilityIssueAction(formData);
      if (result.ok) {
        void mutate();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
          Observation Issues
        </h2>
        <div className="dn-tile inline-flex items-center gap-1 p-1.5">
          {(["open", "resolved"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                TAB_BTN +
                (tab === t
                  ? " bg-[var(--dn-creek-mid)] text-white"
                  : " text-white/60 hover:text-white")
              }
            >
              {t === "open" ? "Open" : "Resolved"}
            </button>
          ))}
        </div>
      </div>

      {issues.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <BellOff className="mx-auto h-8 w-8 text-[var(--dn-text-50)]" aria-hidden />
          <h3 className="mt-4 font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-white">
            {tab === "open" ? "No open issues" : "No resolved issues"}
          </h3>
          <p className="mx-auto mt-3 max-w-prose text-sm text-[var(--dn-text-50)]">
            {tab === "open"
              ? "When Upstream detects an anomaly in your observations (a drop in events, a confidence dip, …) it opens an issue here."
              : "Issues you resolve move to this tab."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {issues.map((issue) => (
            <li
              key={issue.id}
              className="dn-tile flex flex-wrap items-start gap-3 p-[clamp(0.9rem,1.4vw,1.2rem)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-white">{issue.title}</span>
                  <span
                    className={
                      "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
                      (SEVERITY_CHIP[issue.severity] ?? SEVERITY_CHIP.info)
                    }
                  >
                    {issue.severity}
                  </span>
                  <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white/60">
                    {issue.category}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--dn-text-50)]">{issue.message}</p>
                {issue.recommended_action ? (
                  <p className="mt-1 text-sm text-white/70">
                    Recommended: {issue.recommended_action}
                  </p>
                ) : null}
                <EvidenceList evidence={issue.evidence} />
                <p className="mt-1 text-xs font-mono text-[var(--dn-text-50)]">
                  {issue.external_camera_key ? `${issue.external_camera_key} · ` : ""}
                  <RelativeTime value={issue.last_seen_at} />
                  {issue.resolved_at ? (
                    <>
                      {" · resolved "}
                      <RelativeTime value={issue.resolved_at} />
                    </>
                  ) : null}
                </p>
              </div>
              {canResolve && issue.status === "open" ? (
                <button
                  type="button"
                  onClick={() => resolve(issue)}
                  className={GHOST_BTN}
                  disabled={pending}
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                  Resolve
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
