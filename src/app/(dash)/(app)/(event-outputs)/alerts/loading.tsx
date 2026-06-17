export default function Loading() {
  return (
    <section
      className="space-y-5 md:space-y-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <header className="space-y-2">
        <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="h-9 w-40 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-4 w-80 max-w-full rounded bg-white/[0.05] animate-pulse" />
      </header>

      <div className="space-y-4">
        <div className="dn-tile inline-flex items-center gap-2 p-1.5">
          <div className="h-7 w-16 rounded-full bg-white/[0.06] animate-pulse" />
          <div className="h-7 w-20 rounded-full bg-white/[0.06] animate-pulse" />
        </div>

        <ul className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <li
              key={i}
              className="dn-tile flex items-center gap-3 border-l-4 border-l-white/10 p-[clamp(0.9rem,1.4vw,1.2rem)]"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-48 max-w-full rounded bg-white/15 animate-pulse" />
                  <div className="h-4 w-16 rounded-full bg-white/[0.06] animate-pulse" />
                </div>
                <div className="h-3 w-72 max-w-full rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-40 max-w-full rounded bg-white/[0.05] animate-pulse" />
              </div>
              <div className="h-7 w-24 shrink-0 rounded-full bg-white/[0.06] animate-pulse" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
