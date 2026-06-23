import { RelativeTime } from "@/components/data/relative-time";
import { StatusDot, type DotStatus } from "./status-dot";
import type { CollectorBatch } from "@/lib/api/types";

// Recent ingest activity — the most recent observation batches Upstream
// received (last 24h, heartbeat plumbing excluded). A health/activity view, not
// a raw log.

const TH = "px-4 py-3 text-left font-bold uppercase tracking-wide";
const TD = "whitespace-nowrap px-4 py-3";

const STATUS_DOT: Record<string, DotStatus> = {
  completed: "green",
  processing: "yellow",
  pending: "yellow",
  failed: "red",
};

export function CollectorActivityTable({ batches }: { batches: CollectorBatch[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
        Ingest activity
      </h2>
      {batches.length === 0 ? (
        <div className="dn-tile p-[clamp(1.3rem,2.5vw,2rem)] text-center text-sm text-[var(--dn-text-50)]">
          No batches received in the last 24 hours.
        </div>
      ) : (
        <div className="dn-tile overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[clamp(0.8rem,1vw,0.95rem)]">
              <thead>
                <tr className="text-[var(--dn-text-50)]">
                  <th className={TH}>Received</th>
                  <th className={TH}>Source</th>
                  <th className={TH}>External camera/source</th>
                  <th className={TH}>Observations</th>
                  <th className={TH}>Status</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-white/10 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <td className={TD}>
                      <RelativeTime value={b.received_at} />
                    </td>
                    <td className={`${TD} font-bold`}>{b.source}</td>
                    <td className={TD}>{b.external_camera_key ?? "—"}</td>
                    <td className={TD}>{b.observation_count.toLocaleString()}</td>
                    <td className={TD}>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={STATUS_DOT[b.status] ?? "neutral"} />
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
