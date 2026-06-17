export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading"
      className="space-y-5 md:space-y-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded-full bg-white/10 animate-pulse" />
          <div className="h-9 w-64 rounded-lg bg-white/15 animate-pulse" />
        </div>
        <div className="h-10 rounded-full bg-white/[0.06] animate-pulse sm:w-[clamp(190px,22vw,300px)]" />
      </header>

      <div className="dn-tile overflow-hidden p-4 space-y-2">
        <div className="h-9 rounded bg-white/10 animate-pulse" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-9 rounded bg-white/[0.04] animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}
