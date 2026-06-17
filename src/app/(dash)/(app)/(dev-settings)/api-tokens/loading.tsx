export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading"
      className="space-y-5 md:space-y-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
          <div className="h-9 w-56 rounded-lg bg-white/15 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-9 w-full rounded-full bg-white/[0.06] animate-pulse sm:w-[clamp(160px,18vw,240px)]" />
          <div className="h-9 w-28 rounded-lg bg-white/15 animate-pulse" />
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dn-tile h-20 animate-pulse" />
        ))}
      </div>

      <div className="dn-tile overflow-hidden p-4">
        <div className="h-6 rounded bg-white/10 animate-pulse" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-9 rounded bg-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
