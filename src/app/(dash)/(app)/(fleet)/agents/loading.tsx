export default function Loading() {
  return (
    <section className="space-y-5 md:space-y-6" aria-busy="true" aria-label="Loading">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded-full bg-white/10 animate-pulse" />
          <div className="h-9 w-40 rounded-lg bg-white/15 animate-pulse" />
        </div>
        <div className="h-9 w-full rounded-full bg-white/[0.06] animate-pulse sm:w-[clamp(190px,22vw,300px)]" />
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="dn-tile h-20 animate-pulse" />
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="dn-tile h-[clamp(180px,20vw,260px)] animate-pulse" />
        ))}
      </div>
    </section>
  );
}
