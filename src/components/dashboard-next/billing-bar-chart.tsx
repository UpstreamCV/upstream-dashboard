// Pure-CSS 3-bar chart for the Billing tile (no chart lib — the repo has none,
// matching its "no UI kit / no date lib" ethos). Bar heights transcribed from
// Figma Tile 3 (Mar 188, Apr 240, May 162 → relative to the 240 max). May is
// the current month, so it reads darker like the mockup.
const BARS = [
  { label: "Mar", pct: 78, current: false },
  { label: "Apr", pct: 100, current: false },
  { label: "May", pct: 68, current: true },
] as const;

export function BillingBarChart() {
  return (
    <div className="flex flex-col gap-2 w-full max-w-[260px]">
      <div className="flex items-end justify-between gap-3 h-[clamp(90px,12vw,150px)]">
        {BARS.map((b) => (
          <div
            key={b.label}
            className="flex-1 rounded-t-xl"
            style={{
              height: `${b.pct}%`,
              background: b.current
                ? "rgba(0,0,0,0.32)"
                : "rgba(0,0,0,0.13)",
            }}
          />
        ))}
      </div>
      <div className="h-px w-full bg-[rgba(0,0,0,0.15)]" />
      <div className="flex items-center justify-between gap-3">
        {BARS.map((b) => (
          <span
            key={b.label}
            className="flex-1 text-center text-[clamp(0.65rem,0.85vw,0.8rem)] text-[var(--dn-text-50)]"
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
