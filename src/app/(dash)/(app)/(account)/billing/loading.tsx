export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]"
    >
      <div className="space-y-2">
        <div className="h-9 w-40 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-white/10 animate-pulse" />
      </div>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="h-9 w-40 rounded-lg bg-white/15 animate-pulse" />
          <div className="h-5 w-16 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-white/[0.06] animate-pulse" />
        </div>
        <div className="h-4 w-72 max-w-full rounded bg-white/[0.05] animate-pulse" />
        <div className="flex flex-wrap gap-3 pt-2">
          <div className="h-9 w-36 rounded-lg bg-white/10 animate-pulse" />
          <div className="h-9 w-32 rounded-lg bg-white/[0.06] animate-pulse" />
        </div>
      </section>
    </div>
  );
}
