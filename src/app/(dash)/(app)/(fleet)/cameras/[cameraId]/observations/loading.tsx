export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-5"
    >
      {/* Summary KPI tiles row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dn-tile h-24 animate-pulse" />
        ))}
      </div>

      {/* Recent observations panel */}
      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        {/* Header: eyebrow + count, plus filter/control pills */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="h-3 w-32 rounded-full bg-white/10 animate-pulse" />
            <div className="h-3 w-20 rounded-full bg-white/[0.05] animate-pulse" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-8 w-24 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-white/[0.06] animate-pulse" />
            <div className="h-8 w-24 rounded-full bg-white/[0.06] animate-pulse" />
          </div>
        </div>

        {/* Table header bar + observation rows */}
        <div className="space-y-2">
          <div className="h-7 rounded bg-white/10 animate-pulse" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className="h-9 rounded bg-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
