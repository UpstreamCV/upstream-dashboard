import { StatusDot } from "../status-dot";
import { BUCKET_META, type CameraBucket } from "../dn-status";

// One of the four DarkMode summary tiles (Figma frame 409:403 "Tile 1/7/8/9").
// Solid .dn-tile: a StatusDot pinned top-right, an UPPERCASE muted label
// (BUCKET_META.tileLabel), a big bold count with a muted "/total" suffix, and a
// muted "<pct>% of the fleet" footer. pct guards a zero total.
export function CameraBucketStatTile({
  bucket,
  count,
  total,
}: {
  bucket: CameraBucket;
  count: number;
  total: number;
}) {
  const meta = BUCKET_META[bucket];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="dn-tile flex flex-col gap-[clamp(0.5rem,1vw,0.9rem)] p-[clamp(0.9rem,1.6vw,1.4rem)]">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[clamp(0.6rem,0.78vw,0.76rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          {meta.tileLabel}
        </span>
        <StatusDot status={meta.dot} />
      </div>
      <p className="font-bold leading-none">
        <span className="text-[clamp(1.7rem,3.6vw,2.8rem)] text-white">
          {count}
        </span>
        <span className="text-[clamp(1.1rem,2.2vw,1.7rem)] text-[var(--dn-text-40)]">
          /{total}
        </span>
      </p>
      <span className="text-[clamp(0.66rem,0.85vw,0.82rem)] font-bold text-[var(--dn-text-50)]">
        {pct}% of the fleet
      </span>
    </div>
  );
}
