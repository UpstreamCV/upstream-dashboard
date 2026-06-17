export default function Loading() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
      </div>

      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-5 w-16 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-white/[0.06] animate-pulse" />
        </div>
        <div className="h-9 w-72 rounded-lg bg-white/15 animate-pulse" />
      </div>

      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <div className="h-5 w-3/4 rounded bg-white/15 animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between gap-3">
              <div className="h-4 w-20 rounded bg-white/[0.05] animate-pulse" />
              <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-5 w-24 rounded bg-white/15 animate-pulse" />
        <div className="h-40 rounded-xl border border-white/10 bg-white/[0.05] animate-pulse" />
      </div>
    </div>
  );
}
