export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="space-y-4 md:space-y-6"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="dn-tile flex items-center gap-4 p-[clamp(1.1rem,1.8vw,1.5rem)]"
        >
          <div className="h-7 w-7 shrink-0 rounded-lg bg-white/10 animate-pulse" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-5 w-48 rounded bg-white/15 animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-white/[0.05] animate-pulse" />
          </div>
          <div className="h-7 w-24 rounded-full bg-white/[0.06] animate-pulse" />
        </div>
      ))}
    </div>
  );
}
