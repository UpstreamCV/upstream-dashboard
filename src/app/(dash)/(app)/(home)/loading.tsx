// Home-specific Suspense fallback. Home has NO section sub-nav, so — unlike the
// shared (app)/loading.tsx used by the tabbed sections — this skeleton has no
// tab strip. It mirrors Home's real shape: a KPI/stat row over two content
// rows. Home lives in the (home) route group (no URL segment — still `/`) purely
// so it can own this boundary distinct from its tabbed siblings.
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
    </div>
  );
}
