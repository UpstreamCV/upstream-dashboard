export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]"
    >
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-72 rounded bg-white/10 animate-pulse" />
      </div>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <div className="h-9 w-40 rounded-lg bg-white/15 animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-white/[0.06] animate-pulse" />
        </div>
        <div className="mt-3 h-4 w-80 rounded bg-white/[0.05] animate-pulse" />
      </section>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="h-3 w-32 rounded-full bg-white/10 animate-pulse" />
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
                <div className="h-4 w-16 rounded bg-white/[0.05] animate-pulse" />
              </div>
              <div className="h-2 w-full rounded-full bg-white/[0.05] animate-pulse" />
              <div className="h-5 w-14 rounded-full bg-white/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-4 w-full rounded bg-white/[0.05] animate-pulse" />
      </section>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="h-3 w-36 rounded-full bg-white/10 animate-pulse" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-white/10 bg-white/[0.05] p-3 animate-pulse"
            >
              <div className="h-3 w-16 rounded bg-white/10" />
              <div className="mt-2 h-7 w-12 rounded bg-white/15" />
              <div className="mt-2 h-3 w-20 rounded bg-white/[0.05]" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
