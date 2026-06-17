export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]"
    >
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-white/10 animate-pulse" />
      </div>

      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="flex flex-wrap items-center gap-1.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-7 w-20 rounded-full bg-white/[0.06] animate-pulse"
            />
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 rounded-full bg-white/15 animate-pulse" />
                  <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                </div>
                <div className="h-4 w-64 max-w-full rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-40 rounded bg-white/[0.05] animate-pulse" />
              </div>
              <div className="h-3 w-16 shrink-0 rounded bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
