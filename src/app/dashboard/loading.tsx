import { ShellBackdrop } from "@/components/dashboard-next/shell-backdrop";

// Segment-scoped Suspense fallback (the live /dashboard/loading.tsx doesn't
// cover this segment). Renders inside the .dashboard-next theme wrapper but
// above the (app) shell, so it paints its own creek backdrop + drifting orbs
// instead of flashing the global dark body, with light skeleton tiles.
export default function Loading() {
  return (
    <div className="dn-shell-bg relative min-h-dvh overflow-hidden p-3 md:p-5">
      <ShellBackdrop />
      <div className="relative z-10">
        <div className="h-10 w-64 rounded-full bg-white/15 animate-pulse" />
        <div className="mt-4 md:mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`dn-tile h-[clamp(180px,22vw,300px)] animate-pulse ${
                i === 3 ? "xl:col-span-2" : ""
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
