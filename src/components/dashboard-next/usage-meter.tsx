// Labelled "value / max" with a thin progress bar — used by the Plan & usage
// tile for cameras / concurrent sessions / monthly minutes. Server Component.
//
// Pass `value={null}` when the metric is known to be unknown (no backing
// endpoint yet). The label still renders, the cap is shown, but the numerator
// reads `—` and the bar stays flat at 0%. This is more honest than `0` which
// implies measured-zero usage.
export function UsageMeter({
  label,
  value,
  max,
  unit,
}: {
  label: string;
  value: number | null;
  max: number;
  unit?: string;
}) {
  const known = value !== null;
  const pct = known && max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const fmt = (n: number) =>
    `${n.toLocaleString()}${unit ? ` ${unit}` : ""}`;
  // Near the cap → warn color, like the status dots. Unknown → muted track.
  const bar = !known
    ? "var(--dn-text-15)"
    : pct >= 90
      ? "#e15a4c"
      : pct >= 70
        ? "#eedc68"
        : "var(--dn-creek-mid)";

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2 text-[clamp(0.8rem,1vw,1rem)]">
        <span className="font-bold truncate">{label}</span>
        <span className="shrink-0 tabular-nums text-[var(--dn-text-50)]">
          {known ? fmt(value) : "—"} / {fmt(max)}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgba(0,0,0,0.1)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: bar }}
        />
      </div>
    </div>
  );
}
