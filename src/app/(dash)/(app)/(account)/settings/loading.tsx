export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]"
    >
      <div className="space-y-2">
        <div className="h-7 w-40 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-72 rounded bg-white/10 animate-pulse" />
      </div>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="mb-4 h-3 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between gap-3">
              <div className="h-4 w-16 rounded bg-white/[0.05] animate-pulse" />
              <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="mt-4 h-3 w-56 rounded bg-white/[0.05] animate-pulse" />
      </section>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="mb-4 h-3 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="h-10 w-full rounded-lg bg-white/[0.06] animate-pulse" />
      </section>
    </div>
  );
}
