import {
  AlertCircle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from "lucide-react";
import { RelativeTime } from "@/components/data/relative-time";
import type { Alert } from "@/lib/api/types";

// Recent Events (Figma "Some Issues" / "All Good" — bottom-left card). The most
// recent alerts across all statuses: a rounded-square severity badge + title +
// a live relative timestamp. A resolved alert reads green regardless of its
// original severity (the issue is over); otherwise the badge takes the
// severity accent. Badge glyph mirrors the Figma: critical "!", warning "~",
// info "i", resolved "✓".

interface EventVisual {
  color: string;
  icon: LucideIcon;
}

function eventVisual(alert: Alert): EventVisual {
  if (alert.resolved_at) {
    return { color: "var(--dn-green)", icon: CheckCircle2 };
  }
  const sev = alert.severity.toLowerCase();
  if (sev === "critical" || sev === "error") {
    return { color: "var(--dn-red)", icon: AlertCircle };
  }
  if (sev === "warning" || sev === "warn") {
    return { color: "var(--dn-orange)", icon: AlertCircle };
  }
  return { color: "var(--dn-yellow)", icon: Info };
}

export function RecentEvents({ alerts }: { alerts: Alert[] }) {
  return (
    <section className="dn-tile flex flex-col gap-[clamp(0.5rem,1vw,1rem)] p-[clamp(1.25rem,2.2vw,2.25rem)] min-w-0">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          Recent Events
        </h2>
        <span className="font-bold text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)] shrink-0">
          Last 24 hours
        </span>
      </header>

      {alerts.length === 0 ? (
        <p className="py-6 text-[clamp(0.85rem,1.1vw,1rem)] text-[var(--dn-text-50)]">
          No recent events.
        </p>
      ) : (
        <ul className="flex flex-col">
          {alerts.map((alert) => {
            const v = eventVisual(alert);
            const Icon = v.icon;
            return (
              <li
                key={alert.id}
                className="flex items-center gap-3 py-[clamp(0.6rem,1vw,0.85rem)]"
              >
                <span
                  className="grid place-items-center rounded-[8px] shrink-0"
                  style={{
                    background: v.color,
                    width: "clamp(1.6rem,2.4vw,1.9rem)",
                    height: "clamp(1.6rem,2.4vw,1.9rem)",
                  }}
                  aria-hidden
                >
                  <Icon
                    className="h-[clamp(0.95rem,1.4vw,1.15rem)] w-[clamp(0.95rem,1.4vw,1.15rem)] text-white"
                    strokeWidth={2.5}
                  />
                </span>
                <span className="flex-1 min-w-0 truncate font-bold text-[clamp(0.88rem,1.1vw,1.05rem)]">
                  {alert.title}
                </span>
                <span className="shrink-0 text-[clamp(0.78rem,0.95vw,0.9rem)] text-[var(--dn-text-50)]">
                  <RelativeTime value={alert.created_at} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
