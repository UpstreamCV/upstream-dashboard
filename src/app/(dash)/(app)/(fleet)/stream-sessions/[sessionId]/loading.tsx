export default function Loading() {
  return (
    <div className="space-y-4 md:space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />

      <div className="space-y-2">
        <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
        <div className="h-8 w-[min(28rem,80%)] rounded-lg bg-white/15 animate-pulse" />
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          <div className="h-4 w-40 rounded bg-white/[0.05] animate-pulse" />
          <div className="h-4 w-36 rounded bg-white/[0.05] animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <div className="dn-tile h-64 animate-pulse" />
        <div className="dn-tile h-64 animate-pulse" />
      </div>

      <section className="space-y-3 md:space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="h-5 w-44 rounded bg-white/15 animate-pulse" />
          <div className="h-3 w-20 rounded-full bg-white/10 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <div className="dn-tile h-48 animate-pulse" />
          <div className="dn-tile h-48 animate-pulse" />
        </div>
      </section>
    </div>
  );
}
