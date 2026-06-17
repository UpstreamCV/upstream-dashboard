"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BellOff, Check, CheckCheck } from "lucide-react";
import {
  markAlertReadAction,
  resolveAlertAction,
} from "@/app/(dash)/(app)/(event-outputs)/alerts/actions";
import { RelativeTime } from "@/components/data/relative-time";
import type { Alert, AlertListResponse } from "@/lib/api/types";
import { useUpstreamList } from "@/lib/api/use-list";

// Rules/Triggers M1 — alert inbox list. Polls /v1/alerts through the proxy
// at the standard 10s cadence (alerts are near-real-time but not
// frame-rate); the open/resolved tab switches the server-side status filter
// so each tab shows up to the full limit. Mark-read / resolve go through
// Server Actions and then mutate() so the row updates without waiting for
// the next poll.

const TAB_BTN =
  "rounded-full px-3 py-1.5 text-sm font-bold transition disabled:cursor-not-allowed";
const GHOST_BTN =
  "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-xs font-bold text-white/80 transition hover:border-[var(--dn-creek-mid)] hover:text-white disabled:cursor-not-allowed disabled:opacity-50";

const SEVERITY_CHIP: Record<string, string> = {
  info: "bg-white/[0.05] text-white/80",
  warning: "bg-[#8a6d1f]/15 text-[#8a6d1f]",
  critical: "bg-red-700/10 text-red-700",
};

type Tab = "open" | "resolved";

interface AlertsInboxClientProps {
  initialAlerts: Alert[];
  cameraNames: Record<string, string>;
  canResolve: boolean;
}

export function AlertsInboxClient({
  initialAlerts,
  cameraNames,
  canResolve,
}: AlertsInboxClientProps) {
  const [tab, setTab] = useState<Tab>("open");
  const [pending, startTransition] = useTransition();

  const { data, mutate } = useUpstreamList<AlertListResponse>(
    `/v1/alerts?status=${tab}&limit=100`,
    // The server-rendered list is unfiltered; it only seeds the default tab.
    tab === "open"
      ? { fallbackData: { alerts: initialAlerts.filter((a) => a.status === "open") } }
      : undefined,
  );
  const alerts = data?.alerts ?? [];

  function runAction(
    action: (formData: FormData) => Promise<
      { ok: true; alert: Alert } | { ok: false; message: string }
    >,
    alert: Alert,
  ) {
    const formData = new FormData();
    formData.set("alert_id", alert.id);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        void mutate();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
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

      {alerts.length === 0 ? (
        <div className="dn-tile p-[clamp(1.5rem,3vw,2.5rem)] text-center">
          <BellOff
            className="mx-auto h-8 w-8 text-[var(--dn-text-50)]"
            aria-hidden
          />
          <h3 className="mt-4 font-bold text-[clamp(1rem,1.4vw,1.2rem)] text-white">
            {tab === "open" ? "No open alerts" : "No resolved alerts"}
          </h3>
          <p className="mx-auto mt-3 max-w-prose text-sm text-[var(--dn-text-50)]">
            {tab === "open"
              ? "When a camera rule matches a detection, the alert lands here. Create rules per camera under Configure → Triggers & Effects."
              : "Alerts you resolve move to this tab."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => {
            const unread = alert.read_at === null;
            const cameraName = cameraNames[alert.camera_id] ?? "Unknown camera";
            return (
              <li
                key={alert.id}
                className={
                  "dn-tile flex flex-wrap items-center gap-3 p-[clamp(0.9rem,1.4vw,1.2rem)]" +
                  (unread ? " border-l-4 border-l-[var(--dn-creek-mid)]" : "")
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/alerts/${alert.id}`}
                      className={
                        "font-bold text-white hover:underline underline-offset-2" +
                        (unread ? "" : " text-white/80")
                      }
                    >
                      {alert.title}
                    </Link>
                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
                        (SEVERITY_CHIP[alert.severity] ?? SEVERITY_CHIP.info)
                      }
                    >
                      {alert.severity}
                    </span>
                    {unread ? (
                      <span className="rounded-full bg-[var(--dn-creek-mid)]/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[var(--dn-creek-deep)]">
                        new
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--dn-text-50)]">
                    {alert.message}
                  </p>
                  <p className="mt-0.5 text-xs font-mono text-[var(--dn-text-50)]">
                    <Link
                      href={`/cameras/${alert.camera_id}/monitor`}
                      className="underline hover:text-white"
                    >
                      {cameraName}
                    </Link>
                    {" · "}
                    <RelativeTime value={alert.created_at} />
                    {alert.resolved_at ? (
                      <>
                        {" · resolved "}
                        <RelativeTime value={alert.resolved_at} />
                      </>
                    ) : null}
                    {alert.workflow_run_id ? (
                      <>
                        {" · "}
                        <Link
                          href="/workflows"
                          className="underline hover:text-white"
                        >
                          workflow run
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {unread ? (
                    <button
                      type="button"
                      onClick={() => runAction(markAlertReadAction, alert)}
                      className={GHOST_BTN}
                      disabled={pending}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Mark read
                    </button>
                  ) : null}
                  {canResolve && alert.status === "open" ? (
                    <button
                      type="button"
                      onClick={() => runAction(resolveAlertAction, alert)}
                      className={GHOST_BTN}
                      disabled={pending}
                    >
                      <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                      Resolve
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
