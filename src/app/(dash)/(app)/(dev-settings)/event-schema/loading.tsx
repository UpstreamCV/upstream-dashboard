export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-6 p-[clamp(1rem,2vw,1.75rem)]"
    >
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-full max-w-2xl rounded bg-white/10 animate-pulse" />
      </div>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <div className="h-5 w-32 rounded bg-white/15 animate-pulse" />
        <div className="space-y-2">
          <div className="h-7 rounded bg-white/[0.05] animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-9 rounded bg-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </section>

      <section className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)] space-y-3">
        <div className="h-5 w-40 rounded bg-white/15 animate-pulse" />
        <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
        <div className="h-32 rounded bg-white/[0.05] animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-white/10 animate-pulse" />
        <div className="h-32 rounded bg-white/[0.05] animate-pulse" />
      </section>
    </div>
  );
}
