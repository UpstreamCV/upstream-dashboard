export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 md:space-y-6">
      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-4">
        <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="space-y-1">
          <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
          <div className="h-10 rounded-lg bg-white/[0.06] animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
              <div className="h-10 rounded-lg bg-white/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-1">
              <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
              <div className="h-10 rounded-lg bg-white/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-9 w-32 rounded-full bg-white/15 animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {[0, 1].map((p) => (
          <div
            key={p}
            className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3"
          >
            <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex items-baseline justify-between gap-3"
              >
                <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-28 rounded bg-white/[0.05] animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
