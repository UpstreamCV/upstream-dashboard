export default function Loading() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Left column: reliability verdict + current session. */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6">
          <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-20 rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-2/3 rounded bg-white/15 animate-pulse" />
              <div className="h-4 w-full rounded bg-white/[0.05] animate-pulse" />
              <div className="h-4 w-4/5 rounded bg-white/[0.05] animate-pulse" />
            </div>
            <div className="mt-4 h-4 w-40 rounded bg-white/10 animate-pulse" />
          </div>
          <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-20 rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="h-3 w-20 rounded bg-white/[0.05] animate-pulse" />
                  <div className="h-3 w-28 rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: applied geometry + agent. */}
        <div className="space-y-4 md:space-y-6">
          <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
              <div className="h-4 w-24 rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="h-3 w-16 rounded bg-white/[0.05] animate-pulse" />
                  <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
          <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
            <div className="mb-3 h-3 w-16 rounded-full bg-white/10 animate-pulse" />
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="h-3 w-20 rounded bg-white/[0.05] animate-pulse" />
                  <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: camera meta + latest validation. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {[0, 1].map((col) => (
          <div key={col} className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
            <div className="mb-3 h-3 w-20 rounded-full bg-white/10 animate-pulse" />
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="h-3 w-24 rounded bg-white/[0.05] animate-pulse" />
                  <div className="h-3 w-28 rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
