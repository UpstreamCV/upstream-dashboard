export default function Loading() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label="Loading">
      <header className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-white/10 animate-pulse" />
      </header>

      <div className="dn-tile overflow-hidden">
        <div className="grid grid-cols-6 gap-4 border-b border-white/[0.08] px-4 py-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-3 rounded-full bg-white/10 animate-pulse" />
          ))}
        </div>
        <div className="divide-y divide-white/[0.08]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="grid grid-cols-6 items-center gap-4 px-4 py-3">
              <div className="h-4 w-3/4 rounded bg-white/15 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-white/[0.05] animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-white/[0.06] animate-pulse" />
              <div className="h-4 w-20 rounded bg-white/10 animate-pulse" />
              <div className="h-4 w-12 rounded bg-white/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
