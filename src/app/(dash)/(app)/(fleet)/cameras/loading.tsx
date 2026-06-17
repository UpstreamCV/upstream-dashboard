export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading"
      className="space-y-5 md:space-y-6"
    >
      {/* Header: eyebrow "fleet" + title */}
      <div className="space-y-2">
        <div className="h-3 w-16 rounded-full bg-white/10 animate-pulse" />
        <div className="h-9 w-48 rounded-lg bg-white/15 animate-pulse" />
      </div>

      {/* Search pill (left) + Add camera button (right) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-full rounded-full bg-white/[0.06] animate-pulse sm:w-[clamp(220px,26vw,340px)]" />
        <div className="h-10 w-32 rounded-full bg-white/[0.06] animate-pulse" />
      </div>

      {/* Controls: filter chips + sort/view */}
      <div className="flex flex-wrap items-center gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-7 w-20 rounded-full bg-white/[0.06] animate-pulse"
          />
        ))}
      </div>

      {/* Summary stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dn-tile h-20 animate-pulse" />
        ))}
      </div>

      {/* Camera card grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 md:gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="dn-tile h-[clamp(200px,24vw,300px)] animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
