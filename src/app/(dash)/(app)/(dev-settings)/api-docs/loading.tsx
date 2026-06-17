export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]"
    >
      {/* Page header (title + lede) */}
      <div className="space-y-2">
        <div className="h-9 w-40 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-full max-w-xl rounded bg-white/10 animate-pulse" />
      </div>

      {/* Authentication section */}
      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <div className="h-5 w-40 rounded bg-white/15 animate-pulse" />
        <div className="h-4 w-full max-w-lg rounded bg-white/[0.05] animate-pulse" />
        <div className="h-12 rounded-xl border border-white/10 bg-white/[0.05] animate-pulse" />
        <div className="space-y-1">
          <div className="h-3 w-3/4 rounded bg-white/[0.05] animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-white/[0.05] animate-pulse" />
        </div>
        <div className="h-28 rounded-xl border border-white/10 bg-white/[0.05] animate-pulse" />
      </div>

      {/* Endpoints section — 2-col grid of code blocks */}
      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <div className="h-5 w-28 rounded bg-white/15 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-32 rounded-full bg-white/10 animate-pulse" />
              <div className="h-32 rounded-xl border border-white/10 bg-white/[0.05] animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Code examples section — 2 code blocks */}
      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <div className="h-5 w-36 rounded bg-white/15 animate-pulse" />
        <div className="h-4 w-44 rounded bg-white/[0.05] animate-pulse" />
        <div className="h-20 rounded-xl border border-white/10 bg-white/[0.05] animate-pulse" />
        <div className="h-4 w-52 rounded bg-white/[0.05] animate-pulse" />
        <div className="h-20 rounded-xl border border-white/10 bg-white/[0.05] animate-pulse" />
      </div>
    </div>
  );
}
