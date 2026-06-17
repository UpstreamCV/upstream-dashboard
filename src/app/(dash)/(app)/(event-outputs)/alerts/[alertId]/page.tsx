import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { CodeBlock } from "@/components/dashboard-next/code-block";
import { RelativeTime } from "@/components/data/relative-time";
import { StatusDot } from "@/components/dashboard-next/status-dot";
import { getActiveAccount } from "@/lib/account/active";
import { listAlerts } from "@/lib/api/alerts";
import { getCamera } from "@/lib/api/cameras";
import { UpstreamApiError } from "@/lib/api/errors";
import type { Alert, Camera } from "@/lib/api/types";

// Alert Detail — one alert in full. There is NO single-alert GET endpoint
// (api-contracts.md exposes only the list + read/resolve), so we hydrate by
// finding the alert in a recent listAlerts() page. Robust for recent alerts; a
// very old alert id outside the window won't resolve (acceptable until a
// single-alert read exists). Read-only: read/resolve actions stay on the Alert
// Inbox (/alerts).

const ALERT_LOOKUP_LIMIT = 200;

const SEVERITY_CHIP: Record<string, string> = {
  info: "bg-white/[0.06] text-white/70",
  warning: "bg-[#8a6d1f]/15 text-[#caa84a]",
  critical: "bg-red-700/15 text-[#f08a82]",
};

export default async function AlertDetailPage({
  params,
}: {
  params: Promise<{ alertId: string }>;
}) {
  const { alertId } = await params;
  const { activeAccountId } = await getActiveAccount();

  const alerts = await listAlerts({
    accountId: activeAccountId,
    limit: ALERT_LOOKUP_LIMIT,
  });
  const alert: Alert | undefined = alerts.find((a) => a.id === alertId);
  if (!alert) {
    notFound();
  }

  const camera: Camera | null = await getCamera({
    accountId: activeAccountId,
    cameraId: alert.camera_id,
  }).catch((err) => {
    if (err instanceof UpstreamApiError) return null;
    throw err;
  });

  const hasPayload = Object.keys(alert.payload ?? {}).length > 0;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/alerts"
          className="inline-flex items-center gap-1 text-[clamp(0.78rem,1vw,0.92rem)] text-white/75 hover:text-white transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Alerts
        </Link>
      </div>

      <header className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              "rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide " +
              (SEVERITY_CHIP[alert.severity] ?? SEVERITY_CHIP.info)
            }
          >
            {alert.severity}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[clamp(0.78rem,1vw,0.92rem)]">
            <StatusDot status={alert.status === "open" ? "orange" : "neutral"} />
            <span className="text-white/80 font-bold capitalize">
              {alert.status}
            </span>
          </span>
        </div>
        <h1 className="font-bold text-white text-[clamp(1.4rem,2.6vw,2rem)]">
          {alert.title}
        </h1>
      </header>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <p className="text-[clamp(0.9rem,1.1vw,1.05rem)] text-white">
          {alert.message}
        </p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[clamp(0.82rem,1vw,0.95rem)]">
          <Row
            label="Camera"
            value={
              <Link
                href={`/cameras/${alert.camera_id}`}
                className="font-bold text-white hover:underline underline-offset-2"
              >
                {camera?.name ?? alert.camera_id.slice(0, 8) + "…"}
              </Link>
            }
          />
          <Row
            label="Raised"
            value={<RelativeTime value={alert.created_at} className="font-bold text-white" />}
          />
          <Row
            label="Read"
            value={
              alert.read_at ? (
                <RelativeTime value={alert.read_at} className="font-bold text-white" />
              ) : (
                "—"
              )
            }
          />
          <Row
            label="Resolved"
            value={
              alert.resolved_at ? (
                <RelativeTime value={alert.resolved_at} className="font-bold text-white" />
              ) : (
                "—"
              )
            }
          />
          {alert.rule_id ? (
            <Row
              label="Rule"
              value={
                <span className="font-mono text-white/80">
                  {alert.rule_id.slice(0, 8)}…
                </span>
              }
            />
          ) : null}
        </dl>
      </section>

      {hasPayload ? (
        <section className="space-y-3">
          <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
            Payload
          </h2>
          <CodeBlock code={JSON.stringify(alert.payload, null, 2)} copyable />
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--dn-text-50)]">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>
  );
}
