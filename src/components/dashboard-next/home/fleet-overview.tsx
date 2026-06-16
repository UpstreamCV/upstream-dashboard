import { AlertCircle, CheckCircle2, type LucideIcon } from "lucide-react";

// Fleet Overview (Figma "Some Issues" / "All Good" — right middle card). A
// legend of three REAL counts (Critical / Review / Healthy) above a chart
// PLACEHOLDER. The chart is the one deliberately illustrative element on Home —
// there is no fleet-health time-series endpoint, so it is labelled "coming
// soon" and shows no fabricated data points. The faint decorative bar trio is
// drawn from the three real counts (proportional, not historical telemetry).

function LegendItem({
  icon: Icon,
  color,
  count,
  label,
}: {
  icon: LucideIcon;
  color: string;
  count: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      <span
        className="grid place-items-center rounded-full bg-white shrink-0"
        style={{ width: "clamp(1.4rem,2vw,1.7rem)", height: "clamp(1.4rem,2vw,1.7rem)" }}
        aria-hidden
      >
        <Icon
          className="h-[clamp(0.95rem,1.3vw,1.15rem)] w-[clamp(0.95rem,1.3vw,1.15rem)]"
          style={{ color }}
          strokeWidth={2.25}
        />
      </span>
      <span className="font-bold text-[clamp(0.82rem,1.05vw,1rem)] whitespace-nowrap">
        {count}{" "}
        <span className="text-[var(--dn-text-70)] font-bold">{label}</span>
      </span>
    </span>
  );
}

export function FleetOverview({
  critical,
  review,
  healthy,
}: {
  critical: number;
  review: number;
  healthy: number;
}) {
  // Proportional decorative bars from the three real counts — purely a static
  // visual, never presented as a measured trend.
  const total = Math.max(1, critical + review + healthy);
  const bars: { color: string; pct: number }[] = [
    { color: "var(--dn-red)", pct: (critical / total) * 100 },
    { color: "var(--dn-orange)", pct: (review / total) * 100 },
    { color: "var(--dn-green)", pct: (healthy / total) * 100 },
  ];

  return (
    <section className="dn-tile flex flex-col gap-[clamp(1rem,1.8vw,1.6rem)] p-[clamp(1.25rem,2.2vw,2.25rem)] min-w-0">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          Fleet Overview
        </h2>
        <span className="font-bold text-[clamp(0.82rem,1vw,0.95rem)] text-[var(--dn-text-50)] shrink-0">
          Last 24 hours
        </span>
      </header>

      <div
        className="flex flex-wrap items-center gap-x-[clamp(0.75rem,1.5vw,1.5rem)] gap-y-2 rounded-full px-[clamp(0.9rem,1.4vw,1.25rem)] py-[clamp(0.55rem,0.9vw,0.8rem)]"
        style={{ background: "rgba(255,255,255,0.04)" }}
      >
        <LegendItem icon={AlertCircle} color="var(--dn-red)" count={critical} label="Critical" />
        <LegendItem icon={AlertCircle} color="var(--dn-orange)" count={review} label="Review" />
        <LegendItem icon={CheckCircle2} color="var(--dn-green)" count={healthy} label="Healthy" />
      </div>

      <div
        className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-[clamp(2rem,5vw,3.5rem)] text-center"
        style={{
          background: "rgba(255,255,255,0.04)",
          borderRadius: "var(--dn-radius-inner)",
        }}
      >
        <div className="flex items-end justify-center gap-2 h-[clamp(2.5rem,6vw,4.5rem)] w-full max-w-[14rem] opacity-40" aria-hidden>
          {bars.map((b, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm"
              style={{
                background: b.color,
                height: `${Math.max(8, b.pct)}%`,
                minHeight: "0.5rem",
              }}
            />
          ))}
        </div>
        <div>
          <p className="font-bold text-[clamp(0.92rem,1.2vw,1.1rem)] text-[var(--dn-text-70)]">
            Fleet health over time
          </p>
          <p className="mt-1 text-[clamp(0.75rem,0.95vw,0.9rem)] text-[var(--dn-text-40)]">
            Time-series coming soon
          </p>
        </div>
      </div>
    </section>
  );
}
