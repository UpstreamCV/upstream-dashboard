export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="glass rounded-3xl px-6 py-5">
        <div className="h-3 w-20 rounded-full bg-glass-stroke animate-pulse" />
        <div className="mt-3 h-7 w-64 rounded-md bg-glass-stroke animate-pulse" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-3xl px-6 py-5 h-28 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
