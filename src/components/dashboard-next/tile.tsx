import Link from "next/link";
import type { ReactNode } from "react";
import { StatusDot, type DotStatus } from "./status-dot";

// Reusable metric tile from Figma DashboardHome (nodes 189:335 etc.). Solid
// white card, Satoshi Bold, giant metric, a status dot by the title, and a
// translucent "View X" pill at the bottom. Sizes are the Figma values halved
// from the 2× frame and expressed with clamp() so the fixed comp scales.
export function Tile({
  title,
  status,
  metric,
  metricSuffix,
  subtitle,
  actionLabel,
  actionHref = "#",
  span = 1,
  children,
}: {
  title: string;
  status?: DotStatus;
  metric?: ReactNode;
  metricSuffix?: ReactNode;
  subtitle?: ReactNode;
  actionLabel: string;
  actionHref?: string;
  span?: 1 | 2;
  children?: ReactNode;
}) {
  return (
    <article
      className={[
        "dn-tile flex flex-col p-[clamp(1.25rem,2.2vw,2.25rem)]",
        "gap-[clamp(0.75rem,1.6vw,1.5rem)] min-w-0",
        span === 2 ? "xl:col-span-2" : "",
      ].join(" ")}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="text-[clamp(1.05rem,1.5vw,1.45rem)] font-bold leading-tight">
          {title}
        </h3>
        {status && <StatusDot status={status} />}
      </header>

      <div className="flex-1 flex flex-col justify-center min-h-0">
        {children ?? (
          <>
            {metric !== undefined && (
              <p className="leading-[0.95] font-bold tracking-tight">
                <span className="text-[clamp(2.75rem,7vw,6rem)]">
                  {metric}
                </span>
                {metricSuffix !== undefined && (
                  <span className="text-[clamp(1.4rem,3.5vw,3rem)] text-[var(--dn-text-50)]">
                    {metricSuffix}
                  </span>
                )}
              </p>
            )}
            {subtitle !== undefined && (
              <p className="mt-2 text-[clamp(0.9rem,1.2vw,1.15rem)] text-[var(--dn-text-50)]">
                {subtitle}
              </p>
            )}
          </>
        )}
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
