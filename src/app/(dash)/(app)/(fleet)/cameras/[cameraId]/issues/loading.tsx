export default function Loading() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label="Loading">
      <div className="flex items-baseline justify-between gap-3">
        <div className="h-6 w-32 rounded-lg bg-white/15 animate-pulse" />
        <div className="h-3 w-16 rounded-full bg-white/10 animate-pulse" />
      </div>

      <section className="space-y-3 md:space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="dn-tile h-40 animate-pulse" />
        ))}
      </section>
    </div>
  );
}
