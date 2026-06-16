import Link from "next/link";
import type { ReactNode } from "react";
import { StatusDot, type DotStatus } from "../status-dot";

// KPI card for the Home redesign (Figma frames 390:341 / 409:196 — the four
// top tiles: Active Cameras / Active Agents / Alerts / Needs Review). Solid
// .dn-tile, ~25px radius, white Satoshi-bold text: a title with a StatusDot at
// the top-right, a giant number with an optional muted "/total" suffix, a
// muted subtitle, and a full-width translucent "View X" pill at the bottom.
//
// Sizes are the Figma 2× values halved and expressed with clamp() so the comp
// scales fluidly across the responsive KPI grid.
export function KpiTile({
  title,
  status,
  metric,
  metricSuffix,
  subtitle,
  actionLabel,
  actionHref,
}: {
  title: string;
  status: DotStatus;
  metric: ReactNode;
  metricSuffix?: ReactNode;
  subtitle: ReactNode;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <article className="dn-tile flex flex-col gap-[clamp(0.75rem,1.6vw,1.5rem)] p-[clamp(1.25rem,2.2vw,2.25rem)] min-w-0">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          {title}
        </h3>
        <StatusDot status={status} />
      </header>

      <div className="flex-1 flex flex-col justify-center min-h-0">
        <p className="leading-[0.95] font-bold tracking-tight">
          <span className="text-[clamp(2.75rem,7vw,6rem)]">{metric}</span>
          {metricSuffix !== undefined && (
            <span className="text-[clamp(1.4rem,3.5vw,3rem)] text-[var(--dn-text-50)]">
              {metricSuffix}
            </span>
          )}
        </p>
        <p className="mt-2 text-[clamp(0.9rem,1.2vw,1.15rem)] text-[var(--dn-text-50)]">
          {subtitle}
        </p>
      </div>

      <Link
        href={actionHref}
        className="dn-btn dn-glow-soft block text-center font-bold py-[clamp(0.65rem,1vw,0.95rem)] px-4 text-[clamp(0.85rem,1vw,1.05rem)]"
      >
        <span className="relative z-10">{actionLabel}</span>
      </Link>
    </article>
  );
}
