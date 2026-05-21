import { StatusDot, type DotStatus } from "./status-dot";

// Compact white summary stat (Cameras page header row). Echoes the Home tile
// look — white .dn-tile, Satoshi bold — but slim: label + count + optional
// status dot, no action footer (that's why Tile isn't reused here).
export function StatCard({
  label,
  value,
  status,
}: {
  label: string;
  value: number | string;
  status?: DotStatus;
}) {
  return (
    <div className="dn-tile flex flex-col gap-2 p-[clamp(0.9rem,1.6vw,1.4rem)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[clamp(0.62rem,0.8vw,0.78rem)] font-bold uppercase tracking-wide text-[var(--dn-text-50)]">
          {label}
        </span>
        {status && <StatusDot status={status} />}
      </div>
      <span className="font-bold leading-none text-[clamp(1.6rem,3.4vw,2.6rem)]">
        {value}
      </span>
    </div>
  );
}
