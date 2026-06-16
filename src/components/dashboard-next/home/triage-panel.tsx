import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import type { Alert } from "@/lib/api/types";
import { severityMeta } from "../dn-status";

// Triage panel (Figma "Some Issues" / "All Good" — left middle card). Lists the
// OPEN alerts the operator needs to act on. When nothing is open it flips to the
// "All Good" empty state: a bright-green-bordered card with a shield, headline,
// and a "View History" pill.
//
// Alerts carry a freeform `severity` string; severityMeta() maps it to the
// redesign's chip fill/text + dot. RelativeTime keeps the timestamp live (never
// a Date.now() snapshot baked at render). Every link points at /alerts.

const ALERTS_HREF = "/alerts";

function TriageRow({ alert }: { alert: Alert }) {
  const sev = severityMeta(alert.severity);
  return (
    <li className="flex items-start gap-[clamp(0.75rem,1.4vw,1.25rem)] py-[clamp(0.9rem,1.6vw,1.4rem)]">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className="rounded-full px-3 py-1 text-[clamp(0.72rem,0.9vw,0.85rem)] font-bold shrink-0"
            style={{ background: sev.chipBg, color: sev.chipText }}
          >
            {sev.chipLabel}
          </span>
          <span className="font-bold text-[clamp(0.95rem,1.2vw,1.15rem)] min-w-0 truncate">
            {alert.title}
          </span>
          <span className="text-[clamp(0.8rem,1vw,0.95rem)] text-[var(--dn-text-50)] shrink-0">
            <RelativeTime value={alert.created_at} />
          </span>
        </div>
        {alert.message && (
          <p className="mt-1.5 text-[clamp(0.82rem,1.05vw,1rem)] text-[var(--dn-text-50)] line-clamp-2">
            {alert.message}
          </p>
        )}
      </div>
      <Link
        href={ALERTS_HREF}
        className="dn-btn dn-glow-soft shrink-0 self-start font-bold px-[clamp(0.85rem,1.2vw,1.1rem)] py-[clamp(0.4rem,0.7vw,0.6rem)] text-[clamp(0.78rem,0.95vw,0.9rem)]"
      >
        <span className="relative z-10">Review</span>
      </Link>
    </li>
  );
}

function TriageEmpty() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-[clamp(2rem,5vw,4rem)] text-center"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "2px solid color-mix(in srgb, var(--dn-green-bright) 50%, transparent)",
        borderRadius: "var(--dn-radius-tile)",
      }}
    >
      <ShieldCheck
        className="h-[clamp(2.75rem,5vw,4rem)] w-[clamp(2.75rem,5vw,4rem)]"
        style={{ color: "var(--dn-green-bright)" }}
        strokeWidth={1.75}
        aria-hidden
      />
      <h3 className="font-bold text-[clamp(1.2rem,2.2vw,1.65rem)]">
        No current issues with your pipeline!
      </h3>
      <p className="text-[clamp(0.85rem,1.1vw,1rem)] text-[var(--dn-text-40)]">
        All issues have been resolved
      </p>
      <Link
        href={ALERTS_HREF}
        className="dn-btn dn-glow-soft mt-1 font-bold px-[clamp(1rem,1.4vw,1.3rem)] py-[clamp(0.45rem,0.75vw,0.65rem)] text-[clamp(0.82rem,1vw,0.95rem)]"
      >
        <span className="relative z-10">View History</span>
      </Link>
    </div>
  );
}

export function TriagePanel({ openAlerts }: { openAlerts: Alert[] }) {
  return (
    <section className="dn-tile flex flex-col gap-[clamp(0.75rem,1.4vw,1.25rem)] p-[clamp(1.25rem,2.2vw,2.25rem)] min-w-0">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          Triage
          <span className="ml-2 font-bold text-[clamp(0.85rem,1.1vw,1.05rem)] text-[var(--dn-text-50)]">
            — What needs your attention
          </span>
        </h2>
        <Link
          href={ALERTS_HREF}
          className="font-bold text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-70)] hover:text-[var(--dn-text)] shrink-0"
        >
          View all
        </Link>
      </header>

      {openAlerts.length === 0 ? (
        <TriageEmpty />
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--dn-text-15)]">
          {openAlerts.map((alert) => (
            <TriageRow key={alert.id} alert={alert} />
          ))}
        </ul>
      )}
    </section>
  );
}
