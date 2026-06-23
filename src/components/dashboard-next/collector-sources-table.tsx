import { RelativeTime } from "@/components/data/relative-time";
import type { CollectorSource } from "@/lib/api/types";

// Which sources are sending observations (last 24h, grouped by source +
// external camera/source key). Heartbeat plumbing is excluded server-side, so
// every row here is real CV data.

const TH = "px-4 py-3 text-left font-bold uppercase tracking-wide";
const TD = "whitespace-nowrap px-4 py-3";

export function CollectorSourcesTable({ sources }: { sources: CollectorSource[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-bold text-[clamp(1rem,1.2vw,1.15rem)] text-white">
        Sources
      </h2>
      {sources.length === 0 ? (
        <div className="dn-tile p-[clamp(1.3rem,2.5vw,2rem)] text-center text-sm text-[var(--dn-text-50)]">
          No sources have sent observations in the last 24 hours.
        </div>
      ) : (
        <div className="dn-tile overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-[clamp(0.8rem,1vw,0.95rem)]">
              <thead>
                <tr className="text-[var(--dn-text-50)]">
                  <th className={TH}>Source</th>
                  <th className={TH}>External camera/source</th>
                  <th className={TH}>Last seen</th>
                  <th className={TH}>Observations</th>
                  <th className={TH}>Events</th>
                  <th className={TH}>Detection summaries</th>
                  <th className={TH}>Open issues</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, i) => (
                  <tr
                    key={`${s.source}:${s.external_camera_key ?? ""}:${i}`}
                    className="border-t border-white/10 hover:bg-[rgba(0,0,0,0.03)]"
                  >
                    <td className={`${TD} font-bold`}>{s.source}</td>
                    <td className={TD}>{s.external_camera_key ?? "—"}</td>
                    <td className={TD}>
                      <RelativeTime value={s.last_seen_at} />
                    </td>
                    <td className={TD}>{s.recent_observations.toLocaleString()}</td>
                    <td className={TD}>{s.recent_events.toLocaleString()}</td>
                    <td className={TD}>
                      {s.recent_detection_summaries.toLocaleString()}
                    </td>
                    <td className={`${TD} font-bold`}>
                      {s.open_issues > 0 ? (
                        <span className="text-[#ff8f57]">{s.open_issues}</span>
                      ) : (
                        0
                      )}
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
