export default function Loading() {
  return (
    <section
      className="space-y-5 md:space-y-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <header className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="h-9 w-56 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-full max-w-2xl rounded bg-white/[0.05] animate-pulse" />
      </header>

      <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
          <div className="h-8 w-48 rounded-full bg-white/[0.06] animate-pulse" />
        </div>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-white/10 bg-white/[0.04] animate-pulse"
            />
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="dn-tile inline-flex items-center gap-1 p-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-8 w-24 rounded-full bg-white/[0.06] animate-pulse"
            />
          ))}
        </div>

        <ul className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <li
              key={i}
              className="dn-tile h-24 p-[clamp(0.9rem,1.4vw,1.2rem)] animate-pulse"
            />
          ))}
        </ul>
      </div>
    </section>
  );
}
