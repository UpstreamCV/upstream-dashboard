// Home-specific Suspense fallback. Home has NO section sub-nav, so — unlike the
// shared (app)/loading.tsx used by the tabbed sections — this skeleton has no
// tab strip. It mirrors Home's real shape: a KPI/stat row, two tall content
// rows (triage + fleet, then recent events + system status), the "More"
// divider, and the preserved 3-col "More" tile grid (first tile spans 2 cols).
// Home lives in the (home) route group (no URL segment — still `/`) purely so it
// can own this boundary distinct from its tabbed siblings.
export default function Loading() {
  return (
    <div
      className="flex flex-col gap-4 md:gap-5"
      aria-busy="true"
      aria-label="Loading"
    >
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dn-tile h-32 animate-pulse" />
        ))}
      </div>

      {/* triage + fleet overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="dn-tile h-[clamp(220px,26vw,340px)] animate-pulse"
          />
        ))}
      </div>

      {/* recent events + system status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="dn-tile h-[clamp(180px,22vw,280px)] animate-pulse"
          />
        ))}
      </div>

      {/* "More" divider */}
      <div className="mt-2 flex items-center gap-3">
        <div className="h-3 w-12 rounded-full bg-white/10 animate-pulse" />
        <span className="h-px flex-1 bg-white/[0.05]" />
      </div>

      {/* "More" tile grid — first tile spans 2 cols (Plan & Usage) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
        <div className="dn-tile h-[clamp(160px,20vw,240px)] xl:col-span-2 animate-pulse" />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="dn-tile h-[clamp(160px,20vw,240px)] animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
