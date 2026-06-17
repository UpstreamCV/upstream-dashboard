export default function Loading() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label="Loading">
      {/* Back-link bar */}
      <div className="flex items-center gap-3">
        <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
      </div>

      {/* Header — eyebrow + title + status pill + id line */}
      <div className="space-y-2">
        <div className="h-3 w-16 rounded-full bg-white/10 animate-pulse" />
        <div className="flex flex-wrap items-center gap-3">
          <div className="h-9 w-56 rounded-lg bg-white/15 animate-pulse" />
          <div className="h-6 w-24 rounded-full bg-white/[0.06] animate-pulse" />
        </div>
        <div className="h-3 w-48 rounded bg-white/[0.05] animate-pulse" />
      </div>

      {/* Heartbeats (col-span-2) + right column (details, cameras) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Heartbeat timeline */}
        <div className="dn-tile lg:col-span-2 h-[clamp(260px,32vw,420px)] p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div className="h-5 w-28 rounded bg-white/15 animate-pulse" />
            <div className="h-3 w-16 rounded bg-white/[0.05] animate-pulse" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 rounded bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        </div>

        {/* Right column — details + cameras */}
        <div className="space-y-4 md:space-y-6">
          <div className="dn-tile h-56 p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
            <div className="h-5 w-20 rounded bg-white/15 animate-pulse" />
            <div className="space-y-2">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 rounded bg-white/[0.05] animate-pulse" />
              ))}
            </div>
          </div>

          <div className="dn-tile h-40 p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="h-5 w-24 rounded bg-white/15 animate-pulse" />
              <div className="h-3 w-6 rounded bg-white/[0.05] animate-pulse" />
            </div>
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-4 rounded bg-white/[0.05] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
